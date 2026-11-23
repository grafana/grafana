package team

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
)

// WithDeletedHandlers wraps the final Team storage so the registry runs once after each successful delete, dropping deletecollection so it cannot skip them.
func WithDeletedHandlers(inner grafanarest.Storage, registry *teamdelete.DeletedRegistry) grafanarest.Storage {
	if registry == nil {
		return inner
	}
	deleted := &deletedStorage{Storage: inner, registry: registry}
	watcher, isWatcher := inner.(rest.Watcher)
	meta, hasMeta := inner.(registryMetadata)
	switch {
	case isWatcher && hasMeta:
		return struct {
			*deletedStorage
			rest.Watcher
			registryMetadata
		}{deleted, watcher, meta}
	case isWatcher:
		return struct {
			*deletedStorage
			rest.Watcher
		}{deleted, watcher}
	case hasMeta:
		return struct {
			*deletedStorage
			registryMetadata
		}{deleted, meta}
	}
	return deleted
}

type deletedStorage struct {
	grafanarest.Storage
	registry *teamdelete.DeletedRegistry
}

func (s *deletedStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// The internal ID is only on the stored object, so read it before it is gone.
	var teamID int64
	if obj, err := s.Get(ctx, name, &metav1.GetOptions{}); err == nil {
		if meta, err := utils.MetaAccessor(obj); err == nil {
			teamID = meta.GetDeprecatedInternalID() // nolint:staticcheck
		}
	}

	obj, deleted, err := s.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil || !deleted || (options != nil && dryrun.IsDryRun(options.DryRun)) {
		return obj, deleted, err
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		log.New("team.deleted").FromContext(ctx).Error("team deleted handlers skipped, no namespace", "teamUID", name, "error", err)
		return obj, deleted, nil
	}
	s.registry.Run(ctx, teamdelete.Deleted{OrgID: ns.OrgID, TeamID: teamID, TeamUID: name})
	return obj, deleted, nil
}
