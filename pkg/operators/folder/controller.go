package folder

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/server"
)

var folderGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1beta1",
	Resource: "folders",
}

// RunFolderController watches Folder objects and logs deletion events.
// This is a bare skeleton: no workqueue, no retries, no finalizers.
func RunFolderController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "folder-controller")
	logger.Info("starting folder controller")

	dynClient, err := buildDynamicClient(deps.Config)
	if err != nil {
		return err
	}

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynClient, 10*time.Minute, "", nil)
	informer := factory.ForResource(folderGVR).Informer()

	_, err = informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		DeleteFunc: func(obj any) {
			accessor, err := utils.MetaAccessor(obj)
			if err != nil {
				logger.Error("folder delete event: failed to read object", "error", err)
				return
			}
			logger.Info("folder deleted",
				"namespace", accessor.GetNamespace(),
				"name", accessor.GetName())
		},
	})
	if err != nil {
		return err
	}

	factory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), informer.HasSynced) {
		logger.Error("failed to sync folder informer cache")
		return ctx.Err()
	}

	logger.Info("folder controller is ready")
	deps.HealthNotifier.SetReady()

	<-ctx.Done()
	deps.HealthNotifier.SetNotReady()
	logger.Info("folder controller shutting down")
	return nil
}
