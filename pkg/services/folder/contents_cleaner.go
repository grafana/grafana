package folder

import (
	"context"
	"sync"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

// contentsCleanupKinds are the kinds the cascade delegates to the cleaner. Dashboards are excluded:
// the cascade deletes them via the dashboard apiserver client, so listing them here would double-delete.
var contentsCleanupKinds = map[string]bool{
	entity.StandardKindAlertRule:    true,
	entity.StandardKindLibraryPanel: true,
}

// ContentsCleaner deletes a folder's contained alert rules and library elements by fanning out to
// RegistryService implementations registered with it directly — independent of the folder Service,
// so the cascade can clean up in the request path and alerting/library panels import folder, not the reverse.
type ContentsCleaner struct {
	mu       sync.RWMutex
	registry map[string]RegistryService
}

func NewContentsCleaner() *ContentsCleaner {
	return &ContentsCleaner{registry: make(map[string]RegistryService)}
}

// Register adds a cleanup for a resource kind. Kinds outside contentsCleanupKinds may register but
// are ignored by DeleteInFolder.
func (c *ContentsCleaner) Register(r RegistryService) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.registry[r.Kind()] = r
}

// targets returns a snapshot of the cleanups DeleteInFolder delegates to.
func (c *ContentsCleaner) targets() []RegistryService {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]RegistryService, 0, len(contentsCleanupKinds))
	for kind, r := range c.registry {
		if contentsCleanupKinds[kind] {
			out = append(out, r)
		}
	}
	return out
}

// DeleteInFolder deletes the alert rules and library elements contained in a single folder. It runs
// under the caller's context, which the cascade promotes to a service identity so it does not orphan
// resources the requesting user cannot see. Dashboards are not touched here.
func (c *ContentsCleaner) DeleteInFolder(ctx context.Context, namespace, folderUID string) error {
	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	for _, r := range c.targets() {
		if err := r.DeleteInFolders(ctx, ns.OrgID, []string{folderUID}, user); err != nil {
			return err
		}
	}
	return nil
}
