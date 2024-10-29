// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/kube-aggregator/pkg/controllers/status/metrics/metrics.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

// The following is a slightly modified version of upstream's metrics. We are more interested in measuring success.
// Hence, the unavailable metrics have been adjusted to produce available metrics instead.

package aggregator

import (
	"sync"

	"k8s.io/component-base/metrics"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
	apiregistrationv1apihelper "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1/helper"
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
	availableGaugeDesc = metrics.NewDesc(
		"st_aggregator_available_apiservice",
		"Gauge of Grafana APIServices which are marked as available broken down by APIService name.",
		[]string{"name"},
		nil,
		metrics.ALPHA,
		"",
	)
)

type AvailabilityMetrics struct {
	availableCounter *metrics.CounterVec

	*availabilityCollector
}

// These metrics are registered in the main kube-aggregator package as well, prefixing with single-tenant (ST) to avoid
// "duplicate metrics collector registration attempted" in https://github.com/prometheus/client_golang
// a more descriptive prefix is already added for apiserver metrics during scraping in cloud and didn't want
// to double a word by using a word such as "grafana" here
func newAvailabilityMetrics() *AvailabilityMetrics {
	return &AvailabilityMetrics{
		availableCounter: metrics.NewCounterVec(
			&metrics.CounterOpts{
				Name:           "st_aggregator_available_apiservice_total",
				Help:           "Counter of Grafana APIServices which are marked as available broken down by APIService name and reason.",
				StabilityLevel: metrics.ALPHA,
			},
			[]string{"name", "reason"},
		),
		availabilityCollector: newAvailabilityCollector(),
	}
}

// Register registers apiservice availability metrics.
func (m *AvailabilityMetrics) Register(
	registrationFunc func(metrics.Registerable) error,
	customRegistrationFunc func(metrics.StableCollector) error,
) error {
	err := registrationFunc(m.availableCounter)
	if err != nil {
		return err
	}

	err = customRegistrationFunc(m.availabilityCollector)
	if err != nil {
		return err
	}

	return nil
}

// AvailableCounter returns a counter to track apiservices marked as available.
func (m *AvailabilityMetrics) AvailableCounter(apiServiceName, reason string) metrics.CounterMetric {
	return m.availableCounter.WithLabelValues(apiServiceName, reason)
}

type availabilityCollector struct {
	metrics.BaseStableCollector

	mtx            sync.RWMutex
	availabilities map[string]bool
}

// SetAvailableGauge set the metrics so that it reflect the current state based on availability of the given service
func (m *AvailabilityMetrics) SetAvailableGauge(newAPIService *apiregistrationv1.APIService) {
	if apiregistrationv1apihelper.IsAPIServiceConditionTrue(newAPIService, apiregistrationv1.Available) {
		m.SetAPIServiceAvailable(newAPIService.Name)
		return
	}

	m.SetAPIServiceUnavailable(newAPIService.Name)
}

// SetAvailableCounter increases the metrics only if the given service is available and its APIServiceCondition has changed
func (m *AvailabilityMetrics) SetAvailableCounter(originalAPIService, newAPIService *apiregistrationv1.APIService) {
	wasAvailable := apiregistrationv1apihelper.IsAPIServiceConditionTrue(originalAPIService, apiregistrationv1.Available)
	isAvailable := apiregistrationv1apihelper.IsAPIServiceConditionTrue(newAPIService, apiregistrationv1.Available)
	statusChanged := isAvailable != wasAvailable

	if statusChanged && isAvailable {
		reason := "UnknownReason"
		if newCondition := apiregistrationv1apihelper.GetAPIServiceConditionByType(newAPIService, apiregistrationv1.Available); newCondition != nil {
			reason = newCondition.Reason
		}
		m.AvailableCounter(newAPIService.Name, reason).Inc()
	}
}

// Check if apiServiceStatusCollector implements necessary interface.
var _ metrics.StableCollector = &availabilityCollector{}

func newAvailabilityCollector() *availabilityCollector {
	return &availabilityCollector{
		availabilities: make(map[string]bool),
	}
}

// DescribeWithStability implements the metrics.StableCollector interface.
func (c *availabilityCollector) DescribeWithStability(ch chan<- *metrics.Desc) {
	ch <- availableGaugeDesc
}

// CollectWithStability implements the metrics.StableCollector interface.
func (c *availabilityCollector) CollectWithStability(ch chan<- metrics.Metric) {
	c.mtx.RLock()
	defer c.mtx.RUnlock()

	for apiServiceName, isAvailable := range c.availabilities {
		gaugeValue := 0.0
		if isAvailable {
			gaugeValue = 1.0
		}
		ch <- metrics.NewLazyConstMetric(
			availableGaugeDesc,
			metrics.GaugeValue,
			gaugeValue,
			apiServiceName,
		)
	}
}

// SetAPIServiceAvailable sets the given apiservice availability gauge to available.
func (c *availabilityCollector) SetAPIServiceAvailable(apiServiceKey string) {
	c.setAPIServiceAvailability(apiServiceKey, true)
}

// SetAPIServiceavailable sets the given apiservice availability gauge to available.
func (c *availabilityCollector) SetAPIServiceUnavailable(apiServiceKey string) {
	c.setAPIServiceAvailability(apiServiceKey, false)
}

func (c *availabilityCollector) setAPIServiceAvailability(apiServiceKey string, availability bool) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	c.availabilities[apiServiceKey] = availability
}

// ForgetAPIService removes the availability gauge of the given apiservice.
func (c *availabilityCollector) ForgetAPIService(apiServiceKey string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	delete(c.availabilities, apiServiceKey)
}
