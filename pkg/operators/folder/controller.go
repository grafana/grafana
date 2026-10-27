package folder

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/server"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// queueGroup is the NATS queue group this controller's subscription joins, so
// each live notification reaches only one replica.
const queueGroup = "folder-controller"

var folderGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1",
	Resource: "folders",
}

// folderResourceInfo names the kind for the app-sdk's schema and the resource for the subject the bus publishes on.
type folderResourceInfo struct{}

func (folderResourceInfo) GroupVersionKind() schema.GroupVersionKind {
	return folderGVR.GroupVersion().WithKind("Folder")
}

func (folderResourceInfo) GroupVersionResource() schema.GroupVersionResource { return folderGVR }

// RunFolderController watches Folder objects and logs deletion events.
// This is a bare skeleton: no workqueue, no retries, no finalizers.
//
// The delta source is NATS-backed when [nats] is enabled — falling back to
// re-list-only if the live subscription can't open, rather than blocking
// readiness on it — otherwise a plain apiserver watch, matching the pattern
// in pkg/registry/apis/provisioning/informer's delta sources.
func RunFolderController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "folder-controller")
	logger.Info("starting folder controller")

	restClient, err := buildRESTClient(deps.Config)
	if err != nil {
		return err
	}

	handler := cache.ResourceEventHandlerFuncs{
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
	}

	subscriber := nats.ProvideSubscriber(nats.ProvideNATSConfig(deps.Config, nil), deps.Registerer)

	var reg cache.ResourceEventHandlerRegistration
	if nats.Enabled(subscriber) {
		var stopSubscriber func() error
		ctx, stopSubscriber = supervision.Watch(ctx, subscriber)
		defer func() {
			deps.HealthNotifier.SetNotReady()
			runErr = errors.Join(runErr, stopSubscriber())
		}()
		if err := services.StartAndAwaitRunning(ctx, subscriber); err != nil {
			if errors.Is(err, context.Canceled) && ctx.Err() != nil {
				err = context.Cause(ctx)
			}
			return fmt.Errorf("failed to start NATS subscriber: %w", err)
		}

		// Keys only: the controller treats an event as a signal and reads the folder itself, so a re-list needs
		// identities and no bodies.
		keys := keysapi.NewHTTPLister(restClient, folderGVR)
		list := func(ctx context.Context) ([]runtime.Object, string, error) {
			return listFolderKeys(ctx, keys)
		}

		inf, err := usinformer.NewBusDeltaSource(subscriber, &folderv1.Folder{}, folderResourceInfo{},
			10*time.Minute, list, usinformer.BusSourceOptions{Group: queueGroup})
		if err != nil {
			return fmt.Errorf("failed to build folder delta source: %w", err)
		}

		reg, err = inf.AddEventHandler(handler)
		if err != nil {
			return err
		}
		go inf.Run(ctx.Done())
	} else {
		factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynamic.New(restClient), 10*time.Minute, "", nil)
		informer := factory.ForResource(folderGVR).Informer()

		reg, err = informer.AddEventHandler(handler)
		if err != nil {
			return err
		}
		factory.Start(ctx.Done())
	}

	if !cache.WaitForCacheSync(ctx.Done(), reg.HasSynced) {
		logger.Error("failed to sync folder informer cache")
		return context.Cause(ctx)
	}

	logger.Info("folder controller is ready")
	deps.HealthNotifier.SetReady()

	<-ctx.Done()
	deps.HealthNotifier.SetNotReady()
	logger.Info("folder controller shutting down")
	return nil
}
