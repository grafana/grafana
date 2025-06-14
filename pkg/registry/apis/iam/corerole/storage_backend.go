package corerole

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ rest.Scoper               = (*RegistryStorage)(nil)
	_ rest.SingularNameProvider = (*RegistryStorage)(nil)
	_ rest.Getter               = (*RegistryStorage)(nil)
	_ rest.Lister               = (*RegistryStorage)(nil)
	_ rest.Storage              = (*RegistryStorage)(nil)
)

type RegistryStorage struct{}

// Destroy implements rest.Storage.
func (s *RegistryStorage) Destroy() {
	panic("unimplemented")
}

// New implements rest.Storage.
func (s *RegistryStorage) New() runtime.Object {
	panic("unimplemented")
}

// ConvertToTable implements rest.Lister.
func (s *RegistryStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*v1.Table, error) {
	panic("unimplemented")
}

// List implements rest.Lister.
func (s *RegistryStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	panic("unimplemented")
}

// NewList implements rest.Lister.
func (s *RegistryStorage) NewList() runtime.Object {
	panic("unimplemented")
}

// Get implements rest.Getter.
func (s *RegistryStorage) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	panic("unimplemented")
}

// GetSingularName implements rest.SingularNameProvider.
func (s *RegistryStorage) GetSingularName() string {
	panic("unimplemented")
}

// NamespaceScoped implements rest.Scoper.
func (s *RegistryStorage) NamespaceScoped() bool {
	panic("unimplemented")
}

var _ resource.StorageBackend = &sqlResourceStorageBackend{}

type sqlResourceStorageBackend struct {
	sql legacysql.LegacyDatabaseProvider
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
	rows, err := s.getRows(ctx, sql, query)
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
func (s *sqlResourceStorageBackend) ReadResource(context.Context, *resourcepb.ReadRequest) *resource.BackendReadResponse {
	panic("unimplemented")
}

// WatchWriteEvents implements resource.StorageBackend.
func (s *sqlResourceStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	panic("unimplemented")
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
