package folder

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/operators/runner"
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

// Operator runs the folder cascade-delete controller: it watches Folder objects and, for each
// terminating folder carrying the cascade finalizer, deletes its contents and releases it.
//
// The delta source is NATS-backed when [nats] is enabled — falling back to
// re-list-only if the live subscription can't open, rather than blocking
// readiness on it — otherwise a plain apiserver watch, matching the pattern
// in pkg/registry/apis/provisioning/informer's delta sources.
var Operator = runner.Operator{
	Name:        "folder-controller",
	Description: "Delete the contents of folders being cascade-deleted",
	Build:       build,
}

func build(rt *runner.Runtime) (*runner.Parts, error) {
	restClient, err := buildRESTClient(rt.Clients, "folders_server_url", folderGVR.Group)
	if err != nil {
		return nil, err
	}
	dashboardClient, err := buildRESTClient(rt.Clients, "dashboards_server_url", dashboardGVR.Group)
	if err != nil {
		return nil, err
	}

	folders := dynamic.New(restClient)
	var controllerOptions []cascadedelete.ControllerOption
	if rt.Cfg.SectionWithEnvOverrides("operator").Key("pending_deletion_recovery").MustBool(false) {
		controllerOptions = append(controllerOptions,
			cascadedelete.WithPendingRecovery(cascadedelete.NewPendingClient(folders)),
			cascadedelete.WithPendingMetrics(rt.Registerer),
		)
	}

	return &runner.Parts{Run: func(ctx context.Context, ready func()) error {
		searchClient, closeSearchClient, err := buildSearchClient(rt.Cfg, rt.Tracer, rt.Registerer)
		if err != nil {
			return err
		}
		defer closeSearchClient()
		controller := cascadedelete.NewDefaultControllerWithOptions(groupRouter{
			byGroup:  map[string]dynamic.Interface{dashboardGVR.Group: dynamic.New(dashboardClient)},
			fallback: folders,
		}, searchClient, controllerOptions)
		// Run shuts the queue down itself, but only once the workers start; every earlier return needs it too.
		defer controller.ShutDown()
		handler := controller.Handler()

		var reg cache.ResourceEventHandlerRegistration
		if nats.Enabled(rt.Subscriber) {
			inf := newFolderInformer(rt.Subscriber, keysapi.NewHTTPLister(restClient, folderGVR))
			reg, err = inf.AddEventHandler(handler)
			if err != nil {
				return err
			}
			go inf.Run(ctx.Done())
		} else {
			factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(folders, cascadedelete.ResyncPeriod, "", nil)
			reg, err = factory.ForResource(folderGVR).Informer().AddEventHandler(handler)
			if err != nil {
				return err
			}
			factory.Start(ctx.Done())
		}

		return runner.SyncThenRun(ctx, ready, func(ctx context.Context) {
			controller.Run(ctx, cascadedelete.DefaultWorkers)
		}, reg.HasSynced)
	}}, nil
}
