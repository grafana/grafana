package informer

import (
	"context"

	sdkmetrics "github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usresource "github.com/grafana/grafana/pkg/storage/unified/resource"
)

// NewFreshnessMetrics builds the app-sdk's read-freshness metrics under this repository's prefix. One set serves
// every kind and is built once per process at the wiring site: a second registration on the same registry panics.
func NewFreshnessMetrics(reg prometheus.Registerer) *operator.FreshnessMetrics {
	m := operator.NewFreshnessMetrics(operator.FreshnessMetricsConfig{
		MetricsConfig: sdkmetrics.Config{Namespace: "grafana_provisioning"},
		// Unified storage embeds the write's timestamp in the resource version, which is what turns a version
		// difference into a lag in seconds.
		ResourceVersionTime: usresource.ResourceVersionTime,
	})
	if reg != nil {
		reg.MustRegister(m.PrometheusCollectors()...)
	}
	return m
}

// announcedVersions is the read side of the announcement tracker, so a getter takes only what it uses.
type announcedVersions interface {
	Announced(id resource.Identifier) int64
}

// observeRepositoryFreshness wraps a RepositoryGetter to record how each read compared to the notification that
// triggered it. Calls pass through untouched.
func observeRepositoryFreshness(inner RepositoryGetter, announced announcedVersions, rec operator.FreshnessRecorder) RepositoryGetter {
	return freshnessRepositoryGetter{RepositoryGetter: inner, announced: announced, rec: rec}
}

type freshnessRepositoryGetter struct {
	RepositoryGetter
	announced announcedVersions
	rec       operator.FreshnessRecorder
}

func (g freshnessRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	id := resource.Identifier{Namespace: namespace, Name: name}
	// Sampled before the read: a read already in flight when a newer write commits may legitimately return the
	// earlier state.
	announced := g.announced.Announced(id)
	repo, err := g.RepositoryGetter.Get(ctx, namespace, name)
	g.rec.Observe(ctx, id, announced, observed(repo, err), err)
	return repo, err
}

// observeConnectionFreshness is observeRepositoryFreshness for connections.
func observeConnectionFreshness(inner ConnectionGetter, announced announcedVersions, rec operator.FreshnessRecorder) ConnectionGetter {
	return freshnessConnectionGetter{ConnectionGetter: inner, announced: announced, rec: rec}
}

type freshnessConnectionGetter struct {
	ConnectionGetter
	announced announcedVersions
	rec       operator.FreshnessRecorder
}

func (g freshnessConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	id := resource.Identifier{Namespace: namespace, Name: name}
	announced := g.announced.Announced(id)
	conn, err := g.ConnectionGetter.Get(ctx, namespace, name)
	g.rec.Observe(ctx, id, announced, observed(conn, err), err)
	return conn, err
}

// observed adapts a read's result to the recorder's contract. Only a successful read carries a version worth
// judging, so a failed one is handed nothing rather than a typed nil.
func observed[T resource.WrappedObjectType](obj T, err error) resource.Object {
	if err != nil {
		return nil
	}
	return resource.NewWrappedObject(obj)
}
