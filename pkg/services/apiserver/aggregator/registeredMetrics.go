package aggregator

import (
	"sync"

	"k8s.io/component-base/metrics"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
)

/*
 * By default, all the following metrics are defined as falling under
 * ALPHA stability level https://github.com/kubernetes/enhancements/blob/master/keps/sig-instrumentation/1209-metrics-stability/kubernetes-control-plane-metrics-stability.md#stability-classes)
 *
 * Promoting the stability level of the metric is a responsibility of the component owner, since it
 * involves explicitly acknowledging support for the metric across multiple releases, in accordance with
 * the metric stability policy.
 */
var (
	registeredGaugeDesc = metrics.NewDesc(
		"st_aggregator_registered_apiservice",
		"Gauge of Grafana APIServices which are marked as registered broken down by APIService name.",
		[]string{"name"},
		nil,
		metrics.ALPHA,
		"",
	)
)

type RegisteredMetrics struct {
	registeredCounter *metrics.CounterVec

	*registeredCollector
}

// These metrics are registered in the main kube-aggregator package as well, prefixing with single-tenant (ST) to avoid
// "duplicate metrics collector registration attempted" in https://github.com/prometheus/client_golang
// a more descriptive prefix is already added for apiserver metrics during scraping in cloud and didn't want
// to double a word by using a word such as "grafana" here
func newRegisteredMetrics() *RegisteredMetrics {
	return &RegisteredMetrics{
		registeredCounter: metrics.NewCounterVec(
			&metrics.CounterOpts{
				Name:           "st_aggregator_registered_apiservice_total",
				Help:           "Counter of Grafana APIServices which are marked as registered broken down by APIService name and reason.",
				StabilityLevel: metrics.ALPHA,
			},
			[]string{"name", "reason"},
		),
		registeredCollector: newRegisteredCollector(),
	}
}

// Register registers apiservice availability metrics.
func (m *RegisteredMetrics) Register(
	registrationFunc func(metrics.Registerable) error,
	customRegistrationFunc func(metrics.StableCollector) error,
) error {
	err := registrationFunc(m.registeredCounter)
	if err != nil {
		return err
	}

	err = customRegistrationFunc(m.registeredCollector)
	if err != nil {
		return err
	}

	return nil
}

// RegisteredCounter returns a counter to track apiservices marked as registered.
func (m *RegisteredMetrics) RegisteredCounter(apiServiceName string) metrics.CounterMetric {
	return m.registeredCounter.WithLabelValues(apiServiceName)
}

type registeredCollector struct {
	metrics.BaseStableCollector

	mtx        sync.RWMutex
	registered map[string]bool
}

// SetRegisteredGauge set the metrics so that it reflect the current state based on availability of the given service
func (m *RegisteredMetrics) SetRegisteredGauge(newAPIService *apiregistrationv1.APIService) {
	m.setAPIServiceRegistered(newAPIService.Name)
}

func (m *RegisteredMetrics) SetRegisteredCounter(newAPIService *apiregistrationv1.APIService) {
	m.RegisteredCounter(newAPIService.Name).Inc()
}

// Check if apiServiceStatusCollector implements necessary interface.
var _ metrics.StableCollector = &registeredCollector{}

func newRegisteredCollector() *registeredCollector {
	return &registeredCollector{
		registered: make(map[string]bool),
	}
}

// DescribeWithStability implements the metrics.StableCollector interface.
func (c *registeredCollector) DescribeWithStability(ch chan<- *metrics.Desc) {
	ch <- registeredGaugeDesc
}

// CollectWithStability implements the metrics.StableCollector interface.
func (c *registeredCollector) CollectWithStability(ch chan<- metrics.Metric) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	for apiServiceName := range c.registered {
		gaugeValue := 1.0

		ch <- metrics.NewLazyConstMetric(
			registeredGaugeDesc,
			metrics.GaugeValue,
			gaugeValue,
			apiServiceName,
		)
	}
}

func (c *registeredCollector) setAPIServiceRegistered(apiServiceKey string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	c.registered[apiServiceKey] = true
}

// ForgetAPIService removes the registered gauge of the given apiservice.
func (c *registeredCollector) ForgetAPIService(apiServiceKey string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	delete(c.registered, apiServiceKey)
}
