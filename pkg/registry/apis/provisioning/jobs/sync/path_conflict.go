package sync

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RepositoriesGetter is the subset of the generated provisioning clientset used to
// list repositories in a namespace when checking for path conflicts before syncing.
type RepositoriesGetter interface {
	Repositories(namespace string) provisioningclient.RepositoryInterface
}

// checkPathConflict fails the sync/pull job when another repository in the same
// namespace shares cfg's URL/branch/path and has sync enabled. Unlike the
// reconciliation-time warning (controller.RepositoryPathConflictChecker), this
// blocks the job outright: two repositories actively syncing the same content
// would otherwise race to create/update/delete each other's resources.
func (r *SyncWorker) checkPathConflict(ctx context.Context, cfg *provisioning.Repository) error {
	if r.repos == nil {
		return nil
	}

	others, err := listRepositories(ctx, r.repos.Repositories(cfg.Namespace))
	if err != nil {
		return fmt.Errorf("list repositories to check for path conflicts: %w", err)
	}

	for _, other := range others {
		if !other.Spec.Sync.Enabled {
			continue
		}
		if conflictErr, isConflict := repository.PathConflict(cfg, other); isConflict {
			return fmt.Errorf("%w: repository %q has sync enabled and shares this url/branch/path", conflictErr, other.Name)
		}
	}

	return nil
}

func listRepositories(ctx context.Context, client provisioningclient.RepositoryInterface) ([]*provisioning.Repository, error) {
	var all []*provisioning.Repository
	continueToken := ""
	for {
		list, err := client.List(ctx, metav1.ListOptions{Limit: 100, Continue: continueToken})
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			all = append(all, &list.Items[i])
		}
		continueToken = list.Continue
		if continueToken == "" {
			break
		}
	}
	return all, nil
}
