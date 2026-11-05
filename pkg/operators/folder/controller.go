package folder

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/server"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
)

var folderGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1",
	Resource: "folders",
}

// dashboardGVR names the group whose server the cascade deletes dashboards on.
var dashboardGVR = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v1",
	Resource: "dashboards",
}

// RunFolderController runs the folder cascade-delete controller: it watches Folder objects and, for
// each terminating folder carrying the cascade finalizer, deletes its contents and releases it.
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

	restClient, err := buildRESTClient(deps.Config, "folders_server_url", folderGVR.Group)
	if err != nil {
		return err
	}
	dashboardClient, err := buildRESTClient(deps.Config, "dashboards_server_url", dashboardGVR.Group)
	if err != nil {
		return err
	}

	searchClient, closeSearchClient, err := buildSearchClient(deps.Config, deps.Tracer, deps.Registerer)
	if err != nil {
		return err
	}
	defer closeSearchClient()
	folders := dynamic.New(restClient)
	controller := cascadedelete.NewDefaultController(groupRouter{
		byGroup:  map[string]dynamic.Interface{dashboardGVR.Group: dynamic.New(dashboardClient)},
		fallback: folders,
	}, searchClient)
	// Run shuts the queue down itself, but only once the workers start; every earlier return needs it too.
	defer controller.ShutDown()
	handler := controller.Handler()

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

		inf := newFolderInformer(subscriber, keysapi.NewHTTPLister(restClient, folderGVR))

		reg, err = inf.AddEventHandler(handler)
		if err != nil {
			return err
		}
		go inf.Run(ctx.Done())
	} else {
		factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(folders, cascadedelete.ResyncPeriod, "", nil)
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

	workersDone := make(chan struct{})
	go func() {
		defer close(workersDone)
		controller.Run(ctx, cascadedelete.DefaultWorkers)
	}()

	logger.Info("folder controller is ready")
	deps.HealthNotifier.SetReady()

	<-ctx.Done()
	deps.HealthNotifier.SetNotReady()
	logger.Info("folder controller shutting down")
	<-workersDone
	return nil
}
