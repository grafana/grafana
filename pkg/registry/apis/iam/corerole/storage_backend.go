package corerole

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
)

func NewStore(corerole utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter,
	reg prometheus.Registerer, ac types.AccessClient, sql legacysql.LegacyDatabaseProvider) (grafanarest.Storage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      newResourceStorageBackend(sql),
		Reg:          reg,
		AccessClient: ac,
	})
	if err != nil {
		return nil, err
	}
	defaultOpts, err := defaultOptsGetter.GetRESTOptions(iamv0alpha1.CoreRoleInfo.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	// TODO should we move the direct client to another package?
	client := legacy.NewDirectResourceClient(server)
	optsGetter := apistore.NewRESTOptionsGetterForClient(client, defaultOpts.StorageConfig.Config, nil)

	// optsGetter.RegisterOptions(corerole.GroupResource(), apistore.StorageOptions{})
	store, err := grafanaregistry.NewRegistryStore(scheme, corerole, optsGetter)
	return store, err
}

var _ resource.StorageBackend = &sqlResourceStorageBackend{}

type sqlResourceStorageBackend struct {
	sql legacysql.LegacyDatabaseProvider

	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func newResourceStorageBackend(sql legacysql.LegacyDatabaseProvider) *sqlResourceStorageBackend {
	return &sqlResourceStorageBackend{
		sql: sql,

		subscribers: make([]chan *resource.WrittenEvent, 0),
		mutex:       sync.Mutex{},
	}
}

// GetResourceStats implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	panic("unimplemented")
}

// ListHistory implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return s.ListIterator(ctx, req, cb)
}

// ListIterator implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	if req.ResourceVersion != 0 {
		return 0, apierrors.NewBadRequest("List with explicit resourceVersion is not supported with this storage backend")
	}

	// opts := req.Options
	// info, err := types.ParseNamespace(opts.Key.Namespace)
	// if err != nil {
	// 	return 0, err
	// }
	// TODO Namespace handling?

	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return 0, err
	}

	query := &ListCoreRolesQuery{
		Pagination: common.Pagination{
			Limit:    req.Limit,
			Continue: token.id,
		},
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return 0, err
	}

	listRV, err := sql.GetResourceVersion(ctx, "corerole", "updated")
	if err != nil {
		return 0, err
	}

	listRV *= 1000
	rows, err := s.getIterator(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err == nil {
		err = cb(rows)
	}
	return listRV, err
}

// ReadResource implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	version := int64(0)
	if req.ResourceVersion > 0 {
		version = req.ResourceVersion
	}

	// TODO what about the version?
	rsp := &resource.BackendReadResponse{
		ResourceVersion: version,
	}

	sql, err := s.sql(ctx)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	role, err := s.getCoreRole(ctx, sql, req.Key.Name)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	if role == nil {
		rsp.Error = resource.AsErrorResult(apierrors.NewNotFound(iamv0alpha1.CoreRoleInfo.GroupResource(), req.Key.Name))
		return rsp
	}

	rsp.Value, err = json.Marshal(role)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}

	return rsp
}

// WatchWriteEvents implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Add the event stream
		s.subscribers = append(s.subscribers, stream)
	}

	// Wait for context done
	go func() {
		// Wait till the context is done
		<-ctx.Done()

		// Then remove the subscription
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Copy all streams without our listener
		subs := []chan *resource.WrittenEvent{}
		for _, sub := range s.subscribers {
			if sub != stream {
				subs = append(subs, sub)
			}
		}
		s.subscribers = subs
	}()
	return stream, nil
}

// WriteEvent implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	panic("unimplemented")
}

type continueToken struct {
	id int64 // the internal id (sort by!)
}

func readContinueToken(next string) (continueToken, error) {
	var err error
	token := continueToken{}
	if next == "" {
		return token, nil
	}
	parts := strings.Split(next, "/")
	if len(parts) < 1 {
		return token, fmt.Errorf("invalid continue token (too few parts)")
	}
	sub := strings.Split(parts[0], ":")
	if sub[0] != "start" {
		return token, fmt.Errorf("expected internal ID in second slug")
	}
	token.id, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("start:%d", r.id)
}
