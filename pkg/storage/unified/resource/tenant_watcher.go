package resource

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
)

var tenantGVR = schema.GroupVersionResource{
	Group:    "cloud.grafana.com",
	Version:  "v1alpha1",
	Resource: "tenants",
}

const (
	labelPendingDelete           = "cloud.grafana.com/pending-delete"
	annotationPendingDeleteAfter = "cloud.grafana.com/pending-delete-after"
)

// TenantWatcher watches Tenant CRDs via a Kubernetes informer and syncs
// pending-delete state to the KV store.
type TenantWatcher struct {
	log    log.Logger
	stopCh chan struct{}
}

// TenantWatcherConfig holds configuration for the TenantWatcher.
type TenantWatcherConfig struct {
	// RESTConfig for connecting to the app-platform API server.
	RESTConfig *rest.Config
	// ResyncInterval is how often the informer re-lists all tenants.
	ResyncInterval time.Duration
	Log            log.Logger
}

// NewTenantWatcher creates and starts a TenantWatcher.
func NewTenantWatcher(ctx context.Context, cfg TenantWatcherConfig) (*TenantWatcher, error) {
	if cfg.RESTConfig == nil {
		return nil, fmt.Errorf("RESTConfig is required")
	}

	logger := cfg.Log
	if logger == nil {
		logger = log.NewNopLogger()
	}

	resync := cfg.ResyncInterval
	if resync <= 0 {
		resync = 5 * time.Minute
	}

	client, err := dynamic.NewForConfig(cfg.RESTConfig)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	tw := &TenantWatcher{
		log:    logger,
		stopCh: make(chan struct{}),
	}

	factory := dynamicinformer.NewDynamicSharedInformerFactory(client, resync)
	informer := factory.ForResource(tenantGVR).Informer()

	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			tw.handleTenant(obj.(*unstructured.Unstructured))
		},
		UpdateFunc: func(_, newObj interface{}) {
			tw.handleTenant(newObj.(*unstructured.Unstructured))
		},
		DeleteFunc: func(obj interface{}) {
			tenant, ok := obj.(*unstructured.Unstructured)
			if !ok {
				tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
				if !ok {
					logger.Warn("unexpected delete event object type")
					return
				}
				tenant = tombstone.Obj.(*unstructured.Unstructured)
			}
			tw.handleTenantDeleted(tenant.GetName())
		},
	})

	factory.Start(tw.stopCh)
	factory.WaitForCacheSync(tw.stopCh)
	logger.Info("tenant watcher started and cache synced")

	return tw, nil
}

// Stop stops the tenant watcher.
func (tw *TenantWatcher) Stop() {
	close(tw.stopCh)
}

func (tw *TenantWatcher) handleTenant(tenant *unstructured.Unstructured) {
	name := tenant.GetName()
	labels := tenant.GetLabels()

	if labels[labelPendingDelete] == "true" {
		deleteAfter := tenant.GetAnnotations()[annotationPendingDeleteAfter]
		tw.markPendingDelete(name, deleteAfter)
	} else {
		tw.clearPendingDelete(name)
	}
}

func (tw *TenantWatcher) handleTenantDeleted(name string) {
	tw.clearPendingDelete(name)
}

// markPendingDelete records that a tenant is pending deletion in the KV store.
func (tw *TenantWatcher) markPendingDelete(name string, deleteAfter string) {
	tw.log.Debug("marking tenant as pending-delete", "tenant", name, "deleteAfter", deleteAfter)
	// TODO: upsert record into KV store with tenant name and deleteAfter timestamp
}

// clearPendingDelete removes the pending-delete record for a tenant from the KV store, if one exists.
func (tw *TenantWatcher) clearPendingDelete(name string) {
	tw.log.Debug("clearing pending-delete for tenant", "tenant", name)
	// TODO: remove record from KV store if it exists
}
