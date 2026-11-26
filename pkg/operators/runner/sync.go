package runner

import (
	"context"
	"fmt"

	"k8s.io/client-go/tools/cache"
)

// SyncThenRun waits for synced, reports ready and runs the controller until it
// returns. Start the informers before calling it. When ctx ends before the
// caches sync it returns ctx's cause without reporting ready.
func SyncThenRun(ctx context.Context, ready func(), run func(context.Context), synced ...cache.InformerSynced) error {
	if !cache.WaitForCacheSync(ctx.Done(), synced...) {
		return fmt.Errorf("informer cache sync failed: %w", context.Cause(ctx))
	}
	ready()
	run(ctx)
	return nil
}
