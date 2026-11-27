package v1beta2_test

import (
	"encoding/json"
	"math/rand"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/apitesting/fuzzer"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	metafuzzer "k8s.io/apimachinery/pkg/apis/meta/fuzzer"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	runtimeserializer "k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/diff"
	"sigs.k8s.io/randfill"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
)

const fuzzIterations = 500

func newRepositoryConversionScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, v0alpha1.AddToScheme(scheme))
	require.NoError(t, v1beta2.AddToScheme(scheme))
	require.NoError(t, v1beta2.RegisterRepositoryConversions(scheme))
	return scheme
}

func newRepositoryFuzzer(scheme *runtime.Scheme, seed int64) *randfill.Filler {
	funcs := fuzzer.MergeFuzzerFuncs(metafuzzer.Funcs, func(runtimeserializer.CodecFactory) []any {
		return []any{
			func(e *v0alpha1.ErrorDetails, c randfill.Continue) {
				c.Fill(&e.Type)
				c.Fill(&e.Field)
				c.Fill(&e.Detail)
				c.Fill(&e.Origin)
				e.BadValue = randomBadValue(c)
			},
			func(e *v1beta2.RepositoryErrorDetails, c randfill.Continue) {
				c.Fill(&e.Type)
				c.Fill(&e.Field)
				c.Fill(&e.Detail)
				c.Fill(&e.Origin)
				e.BadValue = randomBadValue(c)
			},
			// Validation rejects anything but an RFC3339 lastTransitionTime before conversion runs.
			func(cond *v1beta2.RepositoryCondition, c randfill.Continue) {
				c.FillNoCustom(cond)
				if cond.LastTransitionTime != nil {
					cond.LastTransitionTime = new(time.Unix(c.Int63n(1<<32), 0).UTC().Format(time.RFC3339))
				}
			},
			// Validation rejects unknown secure keys before conversion runs.
			func(values *resource.InlineSecureValues, c randfill.Continue) {
				*values = nil
				for _, key := range v1beta2.RepositorySecureKeys {
					if c.Bool() {
						continue
					}
					var value resource.InlineSecureValue
					c.Fill(&value)
					if *values == nil {
						*values = resource.InlineSecureValues{}
					}
					(*values)[key] = value
				}
			},
		}
	})
	return fuzzer.FuzzerFor(funcs, rand.NewSource(seed), runtimeserializer.NewCodecFactory(scheme)).NumElements(0, 3)
}

func randomBadValue(c randfill.Continue) any {
	if c.Bool() {
		return nil
	}
	return c.String(0)
}

// Objects are stored as v0alpha1 JSON, so the round trip starts from what decoding that JSON yields.
func TestRepositoryConversion_FuzzV0alpha1RoundTrip(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)
	f := newRepositoryFuzzer(scheme, time.Now().UnixNano())

	for range fuzzIterations {
		var fuzzed v0alpha1.Repository
		f.Fill(&fuzzed)
		stored := jsonRoundTrip(t, &fuzzed, &v0alpha1.Repository{})

		var converted v1beta2.Repository
		require.NoError(t, scheme.Convert(stored, &converted, nil))
		var back v0alpha1.Repository
		require.NoError(t, scheme.Convert(&converted, &back, nil))

		requireSemanticEqual(t, stored, &back)
		requireJSONEqual(t, stored, &back)
	}
}

func TestRepositoryConversion_FuzzV1beta2RoundTrip(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)
	f := newRepositoryFuzzer(scheme, time.Now().UnixNano())

	for range fuzzIterations {
		var canonical v1beta2.Repository
		f.Fill(&canonical)
		canonicalizeRepository(&canonical)

		var converted v0alpha1.Repository
		require.NoError(t, scheme.Convert(&canonical, &converted, nil))
		var back v1beta2.Repository
		require.NoError(t, scheme.Convert(&converted, &back, nil))

		requireSemanticEqual(t, &canonical, &back)
		requireJSONEqual(t, &canonical, &back)
	}
}

func TestRepositoryConversion_FuzzListRoundTrip(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)
	f := newRepositoryFuzzer(scheme, time.Now().UnixNano())

	for range fuzzIterations / 10 {
		var fuzzed v0alpha1.RepositoryList
		f.Fill(&fuzzed)
		stored := jsonRoundTrip(t, &fuzzed, &v0alpha1.RepositoryList{})

		var converted v1beta2.RepositoryList
		require.NoError(t, scheme.Convert(stored, &converted, nil))
		require.Len(t, converted.Items, len(stored.Items))
		var back v0alpha1.RepositoryList
		require.NoError(t, scheme.Convert(&converted, &back, nil))

		requireSemanticEqual(t, stored, &back)
	}
}

// The fixture holds every field, so it has the same JSON in both versions apart from apiVersion.
func TestRepositoryConversion_GoldenJSON(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)
	v0JSON, err := os.ReadFile("testdata/repository.json")
	require.NoError(t, err)
	v1JSON := strings.Replace(string(v0JSON), v0alpha1.APIVERSION, v1beta2.GroupVersion.String(), 1)

	t.Run("v0alpha1 to v1beta2", func(t *testing.T) {
		var in v0alpha1.Repository
		require.NoError(t, json.Unmarshal(v0JSON, &in))
		out := &v1beta2.Repository{TypeMeta: metav1.TypeMeta{APIVersion: v1beta2.GroupVersion.String(), Kind: in.Kind}}
		require.NoError(t, scheme.Convert(&in, out, nil))
		got, err := json.Marshal(out)
		require.NoError(t, err)
		require.JSONEq(t, v1JSON, string(got))
	})

	t.Run("v1beta2 to v0alpha1", func(t *testing.T) {
		var in v1beta2.Repository
		require.NoError(t, json.Unmarshal([]byte(v1JSON), &in))
		out := &v0alpha1.Repository{TypeMeta: metav1.TypeMeta{APIVersion: v0alpha1.APIVERSION, Kind: in.Kind}}
		require.NoError(t, scheme.Convert(&in, out, nil))
		got, err := json.Marshal(out)
		require.NoError(t, err)
		require.JSONEq(t, string(v0JSON), string(got))
	})
}

func TestRepositoryConversion_Secure(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)

	t.Run("zero entries are dropped", func(t *testing.T) {
		in := &v0alpha1.Repository{Secure: v0alpha1.SecureValues{
			Token:         resource.InlineSecureValue{Create: resource.NewSecretValue("secret")},
			WebhookSecret: resource.InlineSecureValue{Description: new("only a description")},
		}}
		var out v1beta2.Repository
		require.NoError(t, scheme.Convert(in, &out, nil))
		require.Equal(t, resource.InlineSecureValues{
			v1beta2.RepositorySecureToken: {Create: resource.NewSecretValue("secret")},
		}, out.Secure)

		in = &v0alpha1.Repository{}
		require.NoError(t, scheme.Convert(in, &out, nil))
		require.Nil(t, out.Secure)
	})

	// JSON encodes create as "[REDACTED]", so the fuzzed v0alpha1 round trip can't cover it.
	t.Run("raw values survive both directions", func(t *testing.T) {
		in := &v1beta2.Repository{Secure: resource.InlineSecureValues{
			v1beta2.RepositorySecureToken:            {Create: resource.NewSecretValue("token")},
			v1beta2.RepositorySecureWebhookSecret:    {Create: resource.NewSecretValue("webhook"), Description: new("rotated")},
			v1beta2.RepositorySecureCommitSigningKey: {Create: resource.NewSecretValue("key")},
		}}
		var converted v0alpha1.Repository
		require.NoError(t, scheme.Convert(in, &converted, nil))
		require.Equal(t, resource.NewSecretValue("webhook"), converted.Secure.WebhookSecret.Create)

		var back v1beta2.Repository
		require.NoError(t, scheme.Convert(&converted, &back, nil))
		require.Equal(t, in.Secure, back.Secure)
	})

	t.Run("unknown keys are rejected", func(t *testing.T) {
		in := &v1beta2.Repository{Secure: resource.InlineSecureValues{"privateKey": {Name: "key"}}}
		err := scheme.Convert(in, &v0alpha1.Repository{}, nil)
		require.ErrorContains(t, err, `unsupported key "privateKey"`)
	})

	t.Run("keys match the v0alpha1 JSON names", func(t *testing.T) {
		typ := reflect.TypeFor[v0alpha1.SecureValues]()
		names := make([]string, 0, typ.NumField())
		for i := range typ.NumField() {
			name, _, _ := strings.Cut(typ.Field(i).Tag.Get("json"), ",")
			names = append(names, name)
		}
		require.ElementsMatch(t, names, v1beta2.RepositorySecureKeys)
	})
}

func TestRepositoryConversion_Conditions(t *testing.T) {
	scheme := newRepositoryConversionScheme(t)

	t.Run("JSON matches metav1.Condition", func(t *testing.T) {
		transition := metav1.NewTime(time.Date(2026, 11, 23, 18, 30, 15, 0, time.FixedZone("CET", 3600)))
		in := &v0alpha1.Repository{Status: v0alpha1.RepositoryStatus{Conditions: []metav1.Condition{
			{Type: v0alpha1.ConditionTypeReady, Status: metav1.ConditionTrue, ObservedGeneration: 3, LastTransitionTime: transition, Reason: v0alpha1.ReasonAvailable, Message: "ok"},
			{Type: v0alpha1.ConditionTypePullStatus, Status: metav1.ConditionFalse, Reason: v0alpha1.ReasonFailure},
		}}}
		var out v1beta2.Repository
		require.NoError(t, scheme.Convert(in, &out, nil))

		want, err := json.Marshal(in.Status.Conditions)
		require.NoError(t, err)
		got, err := json.Marshal(out.Status.Conditions)
		require.NoError(t, err)
		require.Equal(t, string(want), string(got))
	})

	t.Run("unparsable lastTransitionTime is rejected", func(t *testing.T) {
		in := &v1beta2.Repository{Status: v1beta2.RepositoryStatus{Conditions: []v1beta2.RepositoryCondition{
			{Type: v0alpha1.ConditionTypeReady, LastTransitionTime: new("2026-01-02T03:04:05Z")},
			{Type: v0alpha1.ConditionTypePullStatus, LastTransitionTime: new("yesterday")},
		}}}
		err := scheme.Convert(in, &v0alpha1.Repository{}, nil)
		require.ErrorContains(t, err, "status.conditions[1].lastTransitionTime")
	})
}

// v0alpha1 can't tell a zero value from an unset one, so v1beta2 admission clears pointers to zero
// values (including structs whose fields are all unset) before an object is converted.
func canonicalizeRepository(r *v1beta2.Repository) {
	clearZeroPointers(reflect.ValueOf(&r.Spec).Elem())
	clearZeroPointers(reflect.ValueOf(&r.Status).Elem())
	for key, value := range r.Secure {
		if value.IsZero() {
			delete(r.Secure, key)
		}
	}
	if len(r.Secure) == 0 {
		r.Secure = nil
	}
}

func clearZeroPointers(v reflect.Value) {
	switch v.Kind() {
	case reflect.Pointer:
		if v.IsNil() {
			return
		}
		clearZeroPointers(v.Elem())
		if v.Elem().IsZero() && v.CanSet() {
			v.SetZero()
		}
	case reflect.Struct:
		for i := range v.NumField() {
			clearZeroPointers(v.Field(i))
		}
	case reflect.Slice:
		for i := range v.Len() {
			clearZeroPointers(v.Index(i))
		}
	default:
	}
}

func jsonRoundTrip[T any](t *testing.T, in *T, out *T) *T {
	t.Helper()
	data, err := json.Marshal(in)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(data, out))
	return out
}

func requireSemanticEqual(t *testing.T, want, got any) {
	t.Helper()
	if !apiequality.Semantic.DeepEqual(want, got) {
		t.Fatalf("round trip changed the object:\n%s", diff.Diff(want, got))
	}
}

func requireJSONEqual(t *testing.T, want, got any) {
	t.Helper()
	wantJSON, err := json.Marshal(want)
	require.NoError(t, err)
	gotJSON, err := json.Marshal(got)
	require.NoError(t, err)
	require.JSONEq(t, string(wantJSON), string(gotJSON))
}
