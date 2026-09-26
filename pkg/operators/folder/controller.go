package folder

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/nats"
	foldersapi "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// queueGroup is the NATS queue group this controller's subscription joins, so
// each live notification reaches only one replica.
const queueGroup = "folder-controller"

// cascadeDeleteControllerResync is the informer's periodic full re-list backstop, mirroring
// register.go's post-start hook wiring for the same controller running in-process.
const cascadeDeleteControllerResync = 10 * time.Minute

// cascadeDeleteControllerWorkers is deliberately small: this is a PoC, not a tuned production
// controller.
const cascadeDeleteControllerWorkers = 2

var folderGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1",
	Resource: "folders",
}

// RunFolderController watches Folder objects. When kubernetesFolderCascadeDeleteAsync is enabled,
// it runs the actual PoC cascade delete reconcile logic
// (pkg/registry/apis/folders.CascadeDeleteController) as a standalone operator
// (GF_DEFAULT_TARGET=operator GF_OPERATOR_NAME=folder) -- the same controller type the apiserver's
// own post-start hook drives in-process (see GetPostStartHooks in
// pkg/registry/apis/folders/register.go), just wired to run out-of-process here instead. The
// wiring shape (build deps, construct the real controller, register its event handler, wait for
// cache sync, then Run with ready/shutdown callbacks) mirrors
// pkg/operators/provisioning.RunRepoController.
//
// With the flag disabled, this keeps the original bare-skeleton behavior: watch and log deletes,
// no reconciliation, no finalizers. That skeleton path only supports a subset of what
// CascadeDeleteController needs (no batching, no status, no requeue), so it is left as-is rather
// than routed through the real controller with cascade delete forced off.
func RunFolderController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "folder-controller")
	logger.Info("starting folder controller")

	dynClient, err := buildDynamicClient(deps.Config)
	if err != nil {
		return err
	}

	// Initializes the feature manager for this process (operators run standalone, so unlike the
	// main Grafana process this isn't done for us elsewhere) and, as a side effect, registers the
	// OpenFeature provider so CascadeDeleteAsyncEnabled's evaluation below (and any evaluated
	// inside the controller) resolves correctly. Mirrors pkg/operators/provisioning/jobs.go's
	// buildWorkers.
	featureManager, err := featuremgmt.ProvideManagerService(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to provide feature manager: %w", err)
	}
	_ = featuremgmt.ProvideToggles(featureManager)

	if !foldersapi.CascadeDeleteAsyncEnabled(ctx) {
		return runDeleteLogger(ctx, deps, logger, dynClient)
	}

	return runCascadeDeleteController(ctx, deps, logger, dynClient)
}

// runDeleteLogger is the original bare-skeleton behavior: watch Folder objects and log deletion
// events, no reconciliation. Used when kubernetesFolderCascadeDeleteAsync is disabled.
//
// The delta source is NATS-backed when [nats] is enabled — falling back to
// re-list-only if the live subscription can't open, rather than blocking
// readiness on it — otherwise a plain apiserver watch, matching the pattern
// in pkg/registry/apis/provisioning/informer's delta sources.
func runDeleteLogger(ctx context.Context, deps server.OperatorDependencies, logger logging.Logger, dynClient dynamic.Interface) error {
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
	var err error
	if nats.Enabled(subscriber) {
		newObject := func(ns, name string) runtime.Object {
			return &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
		}
		list := func(ctx context.Context) ([]runtime.Object, int64, error) {
			return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
				return dynClient.Resource(folderGVR).Namespace("").List(ctx, opts)
			})
		}

		inf := usinformer.NewInformer(subscriber, folderGVR, "", 10*time.Minute, queueGroup, nil, newObject, list)
		inf.AllowDegradedStart()

		reg, err = inf.AddEventHandler(handler)
		if err != nil {
			return err
		}
		go inf.Run(ctx.Done())
	} else {
		factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynClient, 10*time.Minute, "", nil)
		informer := factory.ForResource(folderGVR).Informer()

		reg, err = informer.AddEventHandler(handler)
		if err != nil {
			return err
		}
		factory.Start(ctx.Done())
	}

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

// runCascadeDeleteController wires and runs the real PoC cascade delete controller. Unlike
// runDeleteLogger, it always uses a plain apiserver-watch dynamic informer (no NATS delta source):
// this is a PoC and the added complexity of a NATS-backed read seam wasn't judged worth it here --
// a documented, explicit shortcut rather than an oversight.
func runCascadeDeleteController(ctx context.Context, deps server.OperatorDependencies, logger logging.Logger, dynClient dynamic.Interface) error {
	dashDynClient, err := buildDashboardDynamicClient(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to build dashboard dynamic client: %w", err)
	}
	dashboardClient := dashboardClientFunc(dashDynClient)

	searcher, err := buildResourceIndexClient(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to build resource index client: %w", err)
	}

	ctrl := foldersapi.NewCascadeDeleteController(dynClient.Resource(folderGVR), dashboardClient, searcher)

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynClient, cascadeDeleteControllerResync, "", nil)
	informer := factory.ForResource(folderGVR).Informer()
	reg, err := informer.AddEventHandler(ctrl.EventHandler())
	if err != nil {
		return fmt.Errorf("failed to add folder cascade delete event handler: %w", err)
	}
	factory.Start(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), reg.HasSynced) {
		return fmt.Errorf("failed to sync folder informer cache")
	}

	ctrl.Run(ctx, cascadeDeleteControllerWorkers, func() {
		logger.Info("folder cascade delete controller is ready")
		deps.HealthNotifier.SetReady()
	}, func() {
		logger.Info("folder cascade delete controller shutting down")
		deps.HealthNotifier.SetNotReady()
	})
	return nil
}

// dashboardClientFunc adapts a (possibly nil) dashboard dynamic.Interface into the lazy-getter
// shape CascadeDeleteController expects, matching cascadeDeleteStorage's convention of a nil
// client meaning "skip dashboard cleanup" rather than treating it as an error.
func dashboardClientFunc(dashDynClient dynamic.Interface) func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
	if dashDynClient == nil {
		return func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
			return nil, nil
		}
	}
	res := dashDynClient.Resource(dashv1.DashboardResourceInfo.GroupVersionResource())
	return func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		return &res, nil
	}
}
