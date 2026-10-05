package defaultpermissions

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

// Lister returns every resource of one kind in namespace, for Backfill to scan.
// A real implementation lists through unified storage/search; it does not need to
// pre-filter by folder -- Backfill does that, and NewSetter's own existence check
// makes re-processing an already-correct resource a no-op.
type Lister func(ctx context.Context, namespace string) ([]utils.GrafanaMetaAccessor, error)

// Backfill grants default permissions to every root-level resource of cfg's kind that
// lister returns in namespace but that has no ResourcePermission object yet. It calls
// the exact same setter a live create or move-to-root would trigger (see NewSetter), so
// a resource fixed by Backfill ends up with exactly the permissions a fresh write would
// have produced -- there is no second implementation to keep in sync.
//
// actor is the identity recorded as having requested the grant; it is not treated as the
// resource's creator (Backfill is not creating anything), so BuildDefaults should expect
// an identity type that does not itself warrant a creator-admin grant (e.g. a service
// identity) -- passing a real user here would incorrectly grant that user admin on every
// backfilled resource.
//
// Idempotent and safe to re-run, including concurrently with ordinary traffic: merge-not-
// overwrite semantics (see mergePermissions) mean running this repeatedly, or after some
// resources were already fixed by a normal write, changes nothing for anything already
// correct.
//
// This is deliberately just the reusable core, not a runnable job: wiring it to actually
// execute (a grafana-cli command, a startup reconciler alongside
// pkg/services/folderreconcile, or a one-off migration) is an open decision -- see the
// design proposal's "Risks / open questions" section for why. Callers also own pagination
// and multi-namespace iteration; Backfill itself only processes the namespace it's given.
func Backfill(ctx context.Context, cfg Config, lister Lister, namespace string, actor authlib.AuthInfo) (fixed int, err error) {
	setter := NewSetter(cfg)

	objs, err := lister(ctx, namespace)
	if err != nil {
		return 0, fmt.Errorf("list %s: %w", cfg.GVR.Resource, err)
	}

	for _, obj := range objs {
		if !folder.IsRootFolderUID(obj.GetFolder()) {
			continue
		}
		if err := setter(ctx, nil, actor, obj); err != nil {
			return fixed, fmt.Errorf("grant default permissions for %s %s/%s: %w", cfg.GVR.Resource, namespace, obj.GetName(), err)
		}
		fixed++
	}
	return fixed, nil
}
