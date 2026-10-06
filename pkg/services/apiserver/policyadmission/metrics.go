package policyadmission

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/infra/log"
	policyadmission "github.com/grafana/grafana/pkg/policy/admission"
	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
)

// Outcomes of a binding for one request.
const (
	outcomeAllow = "allow"
	outcomeDeny  = "deny"
	outcomeWarn  = "warn"
)

// metrics are labelled by policy, binding and kind only. Namespaces, resource names and users
// are left to the logs, so that the number of series does not grow with the number of tenants
// or resources.
type metrics struct {
	decisions      *prometheus.CounterVec
	evalErrors     *prometheus.CounterVec
	duration       *prometheus.HistogramVec
	compileLookups *prometheus.CounterVec
	compilations   *prometheus.CounterVec
	compiledCached prometheus.Gauge
}

func newMetrics(reg prometheus.Registerer) *metrics {
	return &metrics{
		decisions: register(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_apiserver_validation_policy_decisions_total",
			Help: "Outcome of each validation policy binding for each admitted request, by outcome (allow, deny, warn), policy, binding, group and kind.",
		}, []string{"outcome", "policy", "binding", "group", "kind"})),
		evalErrors: register(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_apiserver_validation_policy_evaluation_errors_total",
			Help: "Validation policy expressions that failed to evaluate, by policy, group, kind and the failure policy applied (Fail or Ignore). policy is empty when the request could not be evaluated at all, in which case it is rejected.",
		}, []string{"policy", "group", "kind", "failure_policy"})),
		duration: register(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grafana_apiserver_validation_policy_evaluation_duration_seconds",
			Help:    "Time spent evaluating the validation policies of a namespace against one request, including reading parameter objects, by group and kind.",
			Buckets: prometheus.ExponentialBuckets(0.0005, 4, 8),
		}, []string{"group", "kind"})),
		compileLookups: register(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_apiserver_validation_policy_compile_cache_lookups_total",
			Help: "Lookups in the compiled validation policy cache, by result (hit, miss).",
		}, []string{"result"})),
		compilations: register(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_apiserver_validation_policy_compilations_total",
			Help: "Validation policy compilations, by result (success, failure).",
		}, []string{"result"})),
		compiledCached: register(reg, prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "grafana_apiserver_validation_policy_compile_cache_entries",
			Help: "Compiled validation policies, and compile failures, held in the cache.",
		})),
	}
}

// register registers c, or returns the collector already registered under its name. Integration
// tests start several servers in one process against the shared legacy registry, so the hook is
// built more than once per registry, as the API builders' metrics are.
func register[C prometheus.Collector](reg prometheus.Registerer, c C) C {
	if reg == nil {
		return c
	}
	if err := reg.Register(c); err != nil {
		var registered prometheus.AlreadyRegisteredError
		if !errors.As(err, &registered) {
			panic(err)
		}
		return registered.ExistingCollector.(C)
	}
	return c
}

func (m *metrics) compileLookup(hit bool) {
	if hit {
		m.compileLookups.WithLabelValues("hit").Inc()
	} else {
		m.compileLookups.WithLabelValues("miss").Inc()
	}
}

func (m *metrics) compiled(err error, entries int) {
	if err != nil {
		m.compilations.WithLabelValues("failure").Inc()
	} else {
		m.compilations.WithLabelValues("success").Inc()
	}
	m.compiledCached.Set(float64(entries))
}

// observer records metrics and logs for every request the policies are evaluated against.
type observer struct {
	log     log.Logger
	metrics *metrics
}

var _ policyadmission.Observer = (*observer)(nil)

func (o *observer) Evaluated(ctx context.Context, a admission.Attributes, set *engine.Set, ev engine.Evaluation, elapsed time.Duration) {
	gvk := a.GetKind()
	o.metrics.duration.WithLabelValues(gvk.Group, gvk.Kind).Observe(elapsed.Seconds())
	logger := o.log.FromContext(ctx)
	req := requestLogArgs(a)

	for _, res := range ev.Results {
		for _, e := range res.Errors {
			o.metrics.evalErrors.WithLabelValues(res.Policy, gvk.Group, gvk.Kind, string(api.FailurePolicyFail)).Inc()
			logger.Error("Validation policy failed to evaluate", req("policy", res.Policy, "binding", res.Binding, "path", e.Path, "failurePolicy", api.FailurePolicyFail, "error", e.Err)...)
		}
		for _, e := range res.Ignored {
			o.metrics.evalErrors.WithLabelValues(res.Policy, gvk.Group, gvk.Kind, string(api.FailurePolicyIgnore)).Inc()
			logger.Error("Validation policy failed to evaluate", req("policy", res.Policy, "binding", res.Binding, "path", e.Path, "failurePolicy", api.FailurePolicyIgnore, "error", e.Err)...)
		}
		if !res.Applicable {
			continue
		}

		// Results of policies with parameters belong to one binding; the others to every
		// binding of the policy that covers the namespace.
		bindings := []string{res.Binding}
		if res.Binding == "" {
			bindings = bindings[:0]
			for _, b := range set.Bindings(res.Policy, a.GetNamespace()) {
				bindings = append(bindings, b.Name)
			}
		}
		for _, binding := range bindings {
			outcome := outcomeAllow
			for _, d := range ev.Decisions {
				if d.Policy != res.Policy || d.Binding != binding {
					continue
				}
				switch d.Action {
				case api.ActionDeny:
					outcome = outcomeDeny
					logger.Info("Validation policy denied request", req("policy", res.Policy, "binding", binding, "validation", d.Validation, "reason", d.Reason, "message", d.Message)...)
				case api.ActionWarn:
					if outcome == outcomeAllow {
						outcome = outcomeWarn
					}
					logger.Info("Validation policy warned about request", req("policy", res.Policy, "binding", binding, "validation", d.Validation, "reason", d.Reason, "message", d.Message)...)
				}
			}
			if outcome == outcomeAllow {
				logger.Debug("Validation policy allowed request", req("policy", res.Policy, "binding", binding)...)
			}
			o.metrics.decisions.WithLabelValues(outcome, res.Policy, binding, gvk.Group, gvk.Kind).Inc()
		}
	}
}

func (o *observer) Failed(ctx context.Context, a admission.Attributes, err error) {
	gvk := a.GetKind()
	o.metrics.evalErrors.WithLabelValues("", gvk.Group, gvk.Kind, string(api.FailurePolicyFail)).Inc()
	o.log.FromContext(ctx).Error("Could not evaluate validation policies, rejecting request", requestLogArgs(a)("error", err)...)
}

// requestLogArgs returns a function that prefixes log key/value pairs with the request's.
func requestLogArgs(a admission.Attributes) func(kv ...any) []any {
	gvk := a.GetKind()
	base := []any{"group", gvk.Group, "kind", gvk.Kind, "namespace", a.GetNamespace(), "name", a.GetName(), "operation", a.GetOperation()}
	return func(kv ...any) []any {
		return append(base[:len(base):len(base)], kv...)
	}
}
