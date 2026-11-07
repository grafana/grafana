package bootstrap

import (
	"context"
	"os"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Run applies the manifests under path via a dynamic client built from restConfig. It never returns
// an error: a bad manifest is logged and skipped, and must never fail apiserver startup.
func Run(ctx context.Context, restConfig *rest.Config, path string, digestKey []byte, logger log.Logger) {
	objs, err := ReadManifests(os.DirFS(path), ".")
	if err != nil {
		logger.Error("failed to read some bootstrap manifests, skipping those", "path", path, "error", err)
	}
	if len(objs) == 0 {
		if err == nil {
			logger.Debug("no bootstrap manifests found", "path", path)
		}
		return
	}

	dyn, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		logger.Error("failed to create bootstrap dynamic client, skipping", "error", err)
		return
	}

	logger.Info("applying bootstrap manifests", "path", path, "count", len(objs))
	NewApplier(dyn, digestKey, logger).Apply(ctx, objs)
}
