package v1beta2

import (
	"encoding/json"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/apitesting/fuzzer"
	metafuzzer "k8s.io/apimachinery/pkg/apis/meta/fuzzer"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"sigs.k8s.io/randfill"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/util/optional"
)

const fuzzIterations = 500

func newConnectionConversionScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, v0alpha1.AddToScheme(scheme))
	require.NoError(t, AddToScheme(scheme))
	require.NoError(t, RegisterConnectionConversions(scheme))
	return scheme
}

// newConnectionFuzzer fills both versions with values their JSON can hold: interface fields get
// JSON scalars, timestamps are RFC3339 and v1beta2 secure maps only use the keys v0alpha1 has fields for.
func newConnectionFuzzer(scheme *runtime.Scheme, seed int64) *randfill.Filler {
	funcs := func(serializer.CodecFactory) []any {
		return []any{
			func(e *v0alpha1.ErrorDetails, c randfill.Continue) {
				e.Type = metav1.CauseType(c.String(0))
				e.Field, e.Detail, e.Origin = c.String(0), c.String(0), c.String(0)
				e.BadValue = fuzzBadValue(c)
			},
			func(e *ConnectionErrorDetails, c randfill.Continue) {
				e.Type = c.String(0)
				c.Fill(&e.Field)
				c.Fill(&e.Detail)
				c.Fill(&e.Origin)
				e.BadValue = fuzzBadValue(c)
			},
			func(cond *ConnectionCondition, c randfill.Continue) {
				c.FillNoCustom(cond)
				cond.LastTransitionTime = nil
				if c.Bool() {
					var ts metav1.Time
					c.Fill(&ts)
					cond.LastTransitionTime = new(ts.UTC().Format(time.RFC3339))
				}
			},
			func(secure *resource.InlineSecureValues, c randfill.Continue) {
				*secure = nil
				for _, key := range ConnectionSecureKeys {
					if c.Bool() {
						continue
					}
					if *secure == nil {
						*secure = resource.InlineSecureValues{}
					}
					var value resource.InlineSecureValue
					c.Fill(&value)
					(*secure)[key] = value
				}
			},
		}
	}
	return fuzzer.FuzzerFor(fuzzer.MergeFuzzerFuncs(metafuzzer.Funcs, funcs), rand.NewSource(seed), serializer.NewCodecFactory(scheme))
}

func fuzzBadValue(c randfill.Continue) any {
	if c.Bool() {
		return nil
	}
	return c.String(0)
}

// jsonRoundTrip returns obj as it reads back from storage, which is the canonical form both directions start from.
func jsonRoundTrip[T any](t *testing.T, obj *T) *T {
	t.Helper()
	b, err := json.Marshal(obj)
	require.NoError(t, err)
	out := new(T)
	require.NoError(t, json.Unmarshal(b, out))
	return out
}

// canonicalConnection applies what v1beta2 admission does before storing: zero optional values unset,
// conditions in the metav1.Condition encoding and no zero secure values.
func canonicalConnection(t *testing.T, in *Connection) *Connection {
	t.Helper()
	optional.ClearZero(&in.Spec)
	optional.ClearZero(&in.Status)
	in.Status.Conditions = NormalizeConditions(in.Status.Conditions)
	for key, value := range in.Secure {
		if value.IsZero() {
			delete(in.Secure, key)
		}
	}
	if in.Status.Token != nil && *in.Status.Token == (ConnectionTokenStatus{}) {
		in.Status.Token = nil
	}
	return jsonRoundTrip(t, in)
}

func TestConnectionConversionRoundTrip(t *testing.T) {
	scheme := newConnectionConversionScheme(t)
	seed := time.Now().UnixNano()
	t.Logf("fuzzer seed %d", seed)
	f := newConnectionFuzzer(scheme, seed)

	t.Run("v0alpha1 to v1beta2 and back is the identity", func(t *testing.T) {
		for range fuzzIterations {
			in := &v0alpha1.Connection{}
			f.Fill(in)
			in = jsonRoundTrip(t, in)

			converted := &Connection{}
			require.NoError(t, scheme.Convert(in, converted, nil))
			out := &v0alpha1.Connection{}
			require.NoError(t, scheme.Convert(converted, out, nil))

			out.TypeMeta = in.TypeMeta
			require.Equal(t, in, out)
		}
	})

	t.Run("canonical v1beta2 to v0alpha1 and back is the identity", func(t *testing.T) {
		for range fuzzIterations {
			in := &Connection{}
			f.Fill(in)
			in = canonicalConnection(t, in)

			converted := &v0alpha1.Connection{}
			require.NoError(t, scheme.Convert(in, converted, nil))
			out := &Connection{}
			require.NoError(t, scheme.Convert(converted, out, nil))

			out.TypeMeta = in.TypeMeta
			require.Equal(t, in, out)
		}
	})

	t.Run("lists convert every item", func(t *testing.T) {
		in := &v0alpha1.ConnectionList{}
		newConnectionFuzzer(scheme, seed).NilChance(0).NumElements(2, 4).Fill(in)
		in = jsonRoundTrip(t, in)

		converted := &ConnectionList{}
		require.NoError(t, scheme.Convert(in, converted, nil))
		require.Equal(t, metav1.TypeMeta{APIVersion: GroupVersion.String(), Kind: "ConnectionList"}, converted.TypeMeta)
		require.Len(t, converted.Items, len(in.Items))
		out := &v0alpha1.ConnectionList{}
		require.NoError(t, scheme.Convert(converted, out, nil))

		out.TypeMeta = in.TypeMeta
		for i := range out.Items {
			out.Items[i].TypeMeta = in.Items[i].TypeMeta
		}
		require.Equal(t, in, out)
	})
}

func TestConnectionConversionGolden(t *testing.T) {
	scheme := newConnectionConversionScheme(t)
	v0JSON, err := os.ReadFile(filepath.Join("testdata", "connection-v0alpha1.json"))
	require.NoError(t, err)
	v1beta2JSON, err := os.ReadFile(filepath.Join("testdata", "connection-v1beta2.json"))
	require.NoError(t, err)

	t.Run("v0alpha1 to v1beta2", func(t *testing.T) {
		in := &v0alpha1.Connection{}
		require.NoError(t, json.Unmarshal(v0JSON, in))
		out := &Connection{}
		require.NoError(t, scheme.Convert(in, out, nil))
		got, err := json.Marshal(out)
		require.NoError(t, err)
		require.JSONEq(t, string(v1beta2JSON), string(got))
	})

	t.Run("v1beta2 to v0alpha1", func(t *testing.T) {
		in := &Connection{}
		require.NoError(t, json.Unmarshal(v1beta2JSON, in))
		out := &v0alpha1.Connection{}
		require.NoError(t, scheme.Convert(in, out, nil))
		got, err := json.Marshal(out)
		require.NoError(t, err)
		require.JSONEq(t, string(v0JSON), string(got))
	})
}

func TestConnectionConversionErrors(t *testing.T) {
	scheme := newConnectionConversionScheme(t)

	t.Run("unknown secure key", func(t *testing.T) {
		in := &Connection{Secure: resource.InlineSecureValues{"webhookSecret": {Name: "s"}}}
		err := scheme.Convert(in, &v0alpha1.Connection{}, nil)
		require.ErrorContains(t, err, `unknown connection secure value "webhookSecret"`)
	})

	t.Run("unparsable lastTransitionTime", func(t *testing.T) {
		in := &Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "broken"},
			Status: ConnectionStatus{Conditions: []ConnectionCondition{
				{Type: "Ready", LastTransitionTime: new("2026-01-02T03:04:05Z")},
				{Type: "Other", LastTransitionTime: new("yesterday")},
			}},
		}
		err := scheme.Convert(in, &v0alpha1.Connection{}, nil)
		require.ErrorContains(t, err, `convert connection "broken"`)
		require.ErrorContains(t, err, "status.conditions[1].lastTransitionTime")
	})

	t.Run("zero secure values are dropped and raw values kept", func(t *testing.T) {
		in := &Connection{Secure: resource.InlineSecureValues{
			ConnectionSecureToken:        {},
			ConnectionSecurePrivateKey:   {Name: "key"},
			ConnectionSecureClientSecret: {Create: "raw-secret"},
		}}
		out := &v0alpha1.Connection{}
		require.NoError(t, scheme.Convert(in, out, nil))
		require.Equal(t, v0alpha1.ConnectionSecure{
			PrivateKey:   resource.InlineSecureValue{Name: "key"},
			ClientSecret: resource.InlineSecureValue{Create: "raw-secret"},
		}, out.Secure)

		back := &Connection{}
		require.NoError(t, scheme.Convert(out, back, nil))
		require.Equal(t, resource.InlineSecureValues{
			ConnectionSecurePrivateKey:   {Name: "key"},
			ConnectionSecureClientSecret: {Create: "raw-secret"},
		}, back.Secure)
	})
}
