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
// unreachable secret file is logged and skipped, and must never fail apiserver startup.
func Run(ctx context.Context, restConfig *rest.Config, path string, logger log.Logger) {
	objs, err := ReadManifests(os.DirFS(path), ".")
	if err != nil {
		logger.Error("failed to read bootstrap manifests, skipping", "path", path, "error", err)
		return
	}
	if len(objs) == 0 {
		logger.Debug("no bootstrap manifests found", "path", path)
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
