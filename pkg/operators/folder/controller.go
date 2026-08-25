package folder

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/server"
)

// queueGroup is the NATS queue group this controller's subscription joins, so
// each live notification reaches only one replica.
const queueGroup = "folder-controller"

var folderGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1",
	Resource: "folders",
}

// RunFolderController watches Folder objects and logs deletion events.
// This is a bare skeleton: no workqueue, no retries, no finalizers.
//
// The delta source is NATS when [nats] is enabled, otherwise an apiserver
// watch — usinformer.Informer picks between them transparently, so the
// DeleteFunc handler below is unaffected either way.
func RunFolderController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "folder-controller")
	logger.Info("starting folder controller")

	dynClient, err := buildDynamicClient(deps.Config)
	if err != nil {
		return err
	}

	subscriber := nats.ProvideSubscriber(nats.ProvideNATSConfig(deps.Config, nil), deps.Registerer)

	newObject := func(ns, name string) runtime.Object {
		return &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return dynClient.Resource(folderGVR).Namespace("").List(ctx, opts)
		})
	}

	inf := usinformer.NewInformer(subscriber, folderGVR, "", 10*time.Minute, queueGroup, nil, newObject, list)

	reg, err := inf.AddEventHandler(cache.ResourceEventHandlerFuncs{
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

	go inf.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), reg.HasSynced) {
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
