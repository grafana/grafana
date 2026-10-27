package informer

import (
	"context"
	"time"

	sdkmetrics "github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// NewJobDeltaSource returns the job delta source: an app-sdk bus informer when the subscriber is enabled, otherwise
// an apiserver-backed SharedIndexInformer. The job controller reads no lister, so callers need only the DeltaSource.
//
// The two paths report their deliveries on different metrics: the bus informer carries the app-sdk's own families,
// in busMetrics, while the apiserver path keeps this package's, on reg. A nil value disables either.
//
// busMetrics is passed in rather than built here because its collectors register on construction: a process that
// built a second set for another kind would panic on the duplicate.
func NewJobDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer, busMetrics *operator.BusInformerMetrics) (DeltaSource, error) {
	resourceName := provisioningapis.JobResourceInfo.GroupVersionResource().Resource
	if nats.Enabled(subscriber) {
		return NewJobBusDeltaSource(subscriber, client, "", resync, busMetrics)
	}
	metrics := newInformerMetrics(reg)
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Jobs().Informer()
	// One metering handler observes each delivery once, however many controller
	// handlers register. AddEventHandler cannot fail on a not-yet-started informer.
	_, _ = inf.AddEventHandler(apiServerMeter{metrics: metrics, resourceName: resourceName})
	return inf, nil
}

// NewJobBusDeltaSource builds the NATS-mode job source. namespace scopes the subscription and the re-list; pass ""
// to cover every namespace.
func NewJobBusDeltaSource(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, busMetrics *operator.BusInformerMetrics) (DeltaSource, error) {
	c := client.ProvisioningV0alpha1()
	list := func(ctx context.Context) ([]runtime.Object, error) {
		objs, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Jobs(namespace).List(ctx, opts)
		})
		return objs, err
	}
	return usinformer.NewBusDeltaSource(subscriber, &provisioningapis.Job{}, &provisioningapis.JobResourceInfo,
		resync, list, usinformer.BusSourceOptions{Namespace: namespace, Group: queueGroup, Metrics: busMetrics})
}

// NewBusInformerMetrics builds the app-sdk's delivery metrics and registers them under this repository's prefix, so
// the series stay findable alongside the ones this package declares. Like those, it is built once per process at the
// wiring site: a second registration on the same registry panics.
func NewBusInformerMetrics(reg prometheus.Registerer) *operator.BusInformerMetrics {
	m := operator.NewBusInformerMetrics(operator.BusInformerMetricsConfig{
		MetricsConfig: sdkmetrics.Config{Namespace: "grafana_provisioning"},
		// Unified storage embeds the write's timestamp in the resource version, which is what dates a change for
		// the delivery latency histograms.
		ResourceVersionTime: resource.ResourceVersionTime,
	})
	if reg != nil {
		reg.MustRegister(m.PrometheusCollectors()...)
	}
	return m
}
