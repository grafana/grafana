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
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/informers"
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
// The folder informer is built with the informer supplier shared with the
// provisioning controllers, which selects its watch mechanism.
func RunFolderController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "folder-controller")
	logger.Info("starting folder controller")

	folderConfig, err := buildRESTConfig(deps.Config, "folders_server_url", folderGVR.Group)
	if err != nil {
		return err
	}
	restClient, err := rest.UnversionedRESTClientFor(dynamic.ConfigFor(folderConfig))
	if err != nil {
		return fmt.Errorf("failed to create %s REST client: %w", folderGVR.Group, err)
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
	var controllerOptions []cascadedelete.ControllerOption
	if deps.Config.SectionWithEnvOverrides("operator").Key("pending_deletion_recovery").MustBool(false) {
		controllerOptions = append(controllerOptions,
			cascadedelete.WithPendingRecovery(cascadedelete.NewPendingClient(folders)),
			cascadedelete.WithPendingMetrics(deps.Registerer),
		)
	}
	controller := cascadedelete.NewDefaultControllerWithOptions(groupRouter{
		byGroup:  map[string]dynamic.Interface{dashboardGVR.Group: dynamic.New(dashboardClient)},
		fallback: folders,
	}, searchClient, controllerOptions)
	// Run shuts the queue down itself, but only once the workers start; every earlier return needs it too.
	defer controller.ShutDown()
	handler := controller.Handler()

	subscriber := nats.ProvideSubscriber(nats.ProvideNATSConfig(deps.Config, nil), deps.Registerer)

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
	}

	source, err := newFolderSource(informers.ProvideSupplier(deps.Config, subscriber), informers.Clients(folderConfig))
	if err != nil {
		return err
	}
	reg, err := source.AddEventHandler(handler)
	if err != nil {
		return err
	}
	go source.Run(ctx.Done())

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
