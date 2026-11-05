package bootstrap

import (
	"context"
	"os"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Run reads provisioning manifests (Repository/Connection) from path and applies them via a dynamic
// client built from restConfig. It never returns an error: a misconfigured manifest or an
// unreachable secret file is logged and skipped, and must never fail apiserver startup. A manifest
// that fails to parse or apply does not stop the others.
func Run(ctx context.Context, restConfig *rest.Config, path string, logger log.Logger) {
	// Errors are per document: the manifests that parsed are applied anyway.
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
	NewApplier(dyn, logger).Apply(ctx, objs)
}
