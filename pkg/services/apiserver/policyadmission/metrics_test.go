package policyadmission

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/warning"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/infra/log"
	policyadmission "github.com/grafana/grafana/pkg/policy/admission"
	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
)

var (
	thingGVK = schema.GroupVersionKind{Group: "things.example.grafana.app", Version: "v1", Kind: "Thing"}
	thingGVR = schema.GroupVersionResource{Group: "things.example.grafana.app", Version: "v1", Resource: "things"}
)

const thingSchema = `{"type": "object", "properties": {"spec": {"type": "object", "properties": {"title": {"type": "string"}}}}}`

type logLine struct {
	level string
	msg   string
	kv    []any
}

// recordingLogger keeps every line. FromContext returns the logger itself so that lines logged
// through a contextual logger are kept too.
type recordingLogger struct {
	lines []logLine
}

var _ log.Logger = (*recordingLogger)(nil)

func (l *recordingLogger) New(...any) *log.ConcreteLogger         { return log.NewNopLogger() }
func (l *recordingLogger) Log(...any) error                       { return nil }
func (l *recordingLogger) FromContext(context.Context) log.Logger { return l }
func (l *recordingLogger) Debug(msg string, kv ...any)            { l.add("debug", msg, kv) }
func (l *recordingLogger) Info(msg string, kv ...any)             { l.add("info", msg, kv) }
func (l *recordingLogger) Warn(msg string, kv ...any)             { l.add("warn", msg, kv) }
func (l *recordingLogger) Error(msg string, kv ...any)            { l.add("error", msg, kv) }

func (l *recordingLogger) add(level, msg string, kv []any) {
	l.lines = append(l.lines, logLine{level: level, msg: msg, kv: kv})
}

func (l *recordingLogger) levels() []string {
	out := make([]string, 0, len(l.lines))
	for _, line := range l.lines {
		out = append(out, line.level)
	}
	return out
}

type staticSets struct {
	set *engine.Set
	err error
}

func (s staticSets) SetFor(context.Context, string) (*engine.Set, error) { return s.set, s.err }

func thingResolver(t *testing.T) policyschema.StaticResolver {
	t.Helper()
	s := &spec.Schema{}
	require.NoError(t, json.Unmarshal([]byte(thingSchema), s))
	return policyschema.StaticResolver{thingGVK: s}
}

func thingPolicy(name, expression string, failurePolicy api.FailurePolicy) api.Policy {
	return api.Policy{
		Name:          name,
		FailurePolicy: failurePolicy,
		Match:         []api.ResourceMatch{{Group: thingGVK.Group, Versions: []string{"v1"}, Kinds: []string{"Thing"}}},
		Validations:   []api.Validation{{Expression: expression, Message: "title is required", FieldPath: "spec.title"}},
	}
}

func thingAttrs(title string) admission.Attributes {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": thingGVK.GroupVersion().String(),
		"kind":       thingGVK.Kind,
		"metadata":   map[string]any{"name": "t1", "namespace": "default"},
		"spec":       map[string]any{"title": title},
	}}
	return admission.NewAttributesRecord(obj, nil, thingGVK, "default", "t1", thingGVR, "", admission.Create, nil, false,
		&user.DefaultInfo{Name: "someone"})
}

// evaluator builds the adapter with the hook's observer over policies bound by bindings.
func evaluator(t *testing.T, policies []api.Policy, bindings []api.Binding) (*policyadmission.Plugin, *metrics, *recordingLogger) {
	t.Helper()
	compiler := engine.NewCompiler(thingResolver(t))
	compiled := make([]*engine.CompiledPolicy, 0, len(policies))
	for _, p := range policies {
		cp, err := compiler.Compile(p)
		require.NoError(t, err)
		compiled = append(compiled, cp)
	}
	set, err := engine.NewSet(compiled, bindings, nil)
	require.NoError(t, err)
	m := newMetrics(prometheus.NewRegistry())
	logger := &recordingLogger{}
	return policyadmission.NewPlugin(staticSets{set: set}, policyadmission.WithObserver(&observer{log: logger, metrics: m})), m, logger
}

func validate(p *policyadmission.Plugin, a admission.Attributes) error {
	ctx := warning.WithWarningRecorder(context.Background(), noWarnings{})
	return p.Validate(ctx, a, nil)
}

type noWarnings struct{}

func (noWarnings) AddWarning(string, string) {}

func evaluations(t *testing.T, m *metrics) uint64 {
	t.Helper()
	ch := make(chan prometheus.Metric, 1)
	m.duration.WithLabelValues(thingGVK.Group, thingGVK.Kind).(prometheus.Histogram).Collect(ch)
	out := &dto.Metric{}
	require.NoError(t, (<-ch).Write(out))
	return out.GetHistogram().GetSampleCount()
}

func TestObserverDecisions(t *testing.T) {
	p, m, logs := evaluator(t,
		[]api.Policy{thingPolicy("titled", "object.spec.title != ''", api.FailurePolicyFail)},
		[]api.Binding{
			{Name: "deny-titled", PolicyName: "titled", Actions: []api.Action{api.ActionDeny}},
			{Name: "warn-titled", PolicyName: "titled", Actions: []api.Action{api.ActionWarn}},
		})
	decisions := func(outcome, binding string) float64 {
		return testutil.ToFloat64(m.decisions.WithLabelValues(outcome, "titled", binding, thingGVK.Group, thingGVK.Kind))
	}

	require.NoError(t, validate(p, thingAttrs("ok")))
	require.Equal(t, 1.0, decisions(outcomeAllow, "deny-titled"))
	require.Equal(t, 1.0, decisions(outcomeAllow, "warn-titled"))
	require.Equal(t, []string{"debug", "debug"}, logs.levels())
	require.Equal(t, "Validation policy allowed request", logs.lines[0].msg)
	require.Subset(t, logs.lines[0].kv, []any{"namespace", "default", "name", "t1", "policy", "titled"})

	logs.lines = nil
	require.Error(t, validate(p, thingAttrs("")))
	require.Equal(t, 1.0, decisions(outcomeDeny, "deny-titled"))
	require.Equal(t, 1.0, decisions(outcomeWarn, "warn-titled"))
	require.ElementsMatch(t, []string{"info", "info"}, logs.levels())
	for _, line := range logs.lines {
		require.Contains(t, []string{"Validation policy denied request", "Validation policy warned about request"}, line.msg)
		require.Subset(t, line.kv, []any{"message", "title is required"})
	}

	require.Equal(t, uint64(2), evaluations(t, m))
	require.Zero(t, testutil.CollectAndCount(m.evalErrors))
}

func TestObserverErrors(t *testing.T) {
	// Integer division by zero fails at runtime for every title.
	const broken = "1 / (size(object.spec.title) - size(object.spec.title)) == 1"
	errorsFor := func(m *metrics, policy string, fp api.FailurePolicy) float64 {
		return testutil.ToFloat64(m.evalErrors.WithLabelValues(policy, thingGVK.Group, thingGVK.Kind, string(fp)))
	}

	t.Run("Fail rejects the request and counts the error", func(t *testing.T) {
		p, m, logs := evaluator(t,
			[]api.Policy{thingPolicy("broken", broken, api.FailurePolicyFail)},
			[]api.Binding{{Name: "deny-broken", PolicyName: "broken", Actions: []api.Action{api.ActionDeny}}})
		require.Error(t, validate(p, thingAttrs("ok")))
		require.Equal(t, 1.0, errorsFor(m, "broken", api.FailurePolicyFail))
		require.Equal(t, 1.0, testutil.ToFloat64(m.decisions.WithLabelValues(outcomeDeny, "broken", "deny-broken", thingGVK.Group, thingGVK.Kind)))
		require.ElementsMatch(t, []string{"error", "info"}, logs.levels())
	})

	t.Run("Ignore admits the request and still counts the error", func(t *testing.T) {
		p, m, logs := evaluator(t,
			[]api.Policy{thingPolicy("broken", broken, api.FailurePolicyIgnore)},
			[]api.Binding{{Name: "deny-broken", PolicyName: "broken", Actions: []api.Action{api.ActionDeny}}})
		require.NoError(t, validate(p, thingAttrs("ok")))
		require.Equal(t, 1.0, errorsFor(m, "broken", api.FailurePolicyIgnore))
		require.Equal(t, 1.0, testutil.ToFloat64(m.decisions.WithLabelValues(outcomeAllow, "broken", "deny-broken", thingGVK.Group, thingGVK.Kind)))
		require.Equal(t, []string{"error", "debug"}, logs.levels())
		require.Subset(t, logs.lines[0].kv, []any{"failurePolicy", api.FailurePolicyIgnore, "path", "validations[0].expression"})
	})

	t.Run("requests that cannot be evaluated are counted without a policy", func(t *testing.T) {
		m := newMetrics(prometheus.NewRegistry())
		logs := &recordingLogger{}
		p := policyadmission.NewPlugin(staticSets{err: errors.New("storage unavailable")}, policyadmission.WithObserver(&observer{log: logs, metrics: m}))
		require.Error(t, validate(p, thingAttrs("ok")))
		require.Equal(t, 1.0, errorsFor(m, "", api.FailurePolicyFail))
		require.Equal(t, []string{"error"}, logs.levels())
		require.Zero(t, testutil.CollectAndCount(m.decisions))
	})
}

func TestCompileMetrics(t *testing.T) {
	m := newMetrics(prometheus.NewRegistry())
	s := newStore(&recordingLogger{}, m, engine.NewCompiler(thingResolver(t)), nil)

	ok := thingPolicy("titled", "object.spec.title != ''", api.FailurePolicyFail)
	_, err := s.compile(ok)
	require.NoError(t, err)
	_, err = s.compile(ok)
	require.NoError(t, err)
	_, err = s.compile(thingPolicy("typo", "object.spec.titel != ''", api.FailurePolicyFail))
	require.Error(t, err)

	require.Equal(t, 1.0, testutil.ToFloat64(m.compileLookups.WithLabelValues("hit")))
	require.Equal(t, 2.0, testutil.ToFloat64(m.compileLookups.WithLabelValues("miss")))
	require.Equal(t, 1.0, testutil.ToFloat64(m.compilations.WithLabelValues("success")))
	require.Equal(t, 1.0, testutil.ToFloat64(m.compilations.WithLabelValues("failure")))
	require.Equal(t, 2.0, testutil.ToFloat64(m.compiledCached))
}

func TestMetricsRegistration(t *testing.T) {
	reg := prometheus.NewRegistry()
	first := newMetrics(reg)
	second := newMetrics(reg)
	require.Same(t, first.decisions, second.decisions, "a hook built again on the same registry shares its collectors")

	first.decisions.WithLabelValues(outcomeAllow, "p", "b", "g", "k").Inc()
	first.duration.WithLabelValues("g", "k").Observe(0.001)
	first.compiledCached.Set(1)
	families, err := reg.Gather()
	require.NoError(t, err)
	names := make([]string, 0, len(families))
	for _, f := range families {
		names = append(names, f.GetName())
	}
	require.Subset(t, names, []string{
		"grafana_apiserver_validation_policy_decisions_total",
		"grafana_apiserver_validation_policy_evaluation_duration_seconds",
		"grafana_apiserver_validation_policy_compile_cache_entries",
	})

	require.NotPanics(t, func() { newMetrics(nil) })
}
