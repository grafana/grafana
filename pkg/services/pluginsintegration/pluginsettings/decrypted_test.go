package pluginsettings

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const testAPIVersion = "something.grafana.app/v7beta6"

func TestEmptyDecryptedSecureJSONLoader(t *testing.T) {
	out, err := EmptyDecryptedSecureJSONLoader(context.Background())
	require.NoError(t, err)
	require.Empty(t, out)
	require.NotNil(t, out)
}

func TestSecureContextShim(t *testing.T) {
	t.Run("WithDecryptedValues without shim is a no-op", func(t *testing.T) {
		ctx := context.Background()
		// Should not panic; later GetDecryptedSecureJSONLoader must fall through
		// to the decrypter.
		WithDecryptedValues(ctx, func(context.Context) (map[string]string, error) {
			t.Fatal("loader should not be invoked")
			return nil, nil
		})

		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", nil)
		loader, err := GetDecryptedSecureJSONLoader(ctx, obj, nil)
		require.NoError(t, err)
		// No secure values configured, so we get the empty loader.
		out, err := loader(ctx)
		require.NoError(t, err)
		require.Empty(t, out)
	})

	t.Run("WithSecureContextShim + WithDecryptedValues short-circuits decrypter", func(t *testing.T) {
		ctx := WithSecureContextShim(context.Background())

		stashed := map[string]string{"token": "abc"}
		WithDecryptedValues(ctx, func(context.Context) (map[string]string, error) {
			return stashed, nil
		})

		// Even with a decrypter and secure values present, the stashed loader wins.
		dec := &stubDecrypter{}
		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
			"token": {Name: "secret-token"},
		})
		loader, err := GetDecryptedSecureJSONLoader(ctx, obj, dec)
		require.NoError(t, err)
		out, err := loader(ctx)
		require.NoError(t, err)
		require.Equal(t, stashed, out)
		require.Zero(t, dec.calls, "decrypter must not be called when values were already stashed")
	})

	t.Run("WithSecureContextShim without WithDecryptedValues falls through", func(t *testing.T) {
		ctx := WithSecureContextShim(context.Background())

		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", nil)
		loader, err := GetDecryptedSecureJSONLoader(ctx, obj, nil)
		require.NoError(t, err)
		out, err := loader(ctx)
		require.NoError(t, err)
		require.Empty(t, out)
	})
}

func TestGetDecryptedSecureJSONLoader(t *testing.T) {
	t.Run("no secure values returns empty loader", func(t *testing.T) {
		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{})
		loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, nil)
		require.NoError(t, err)
		out, err := loader(context.Background())
		require.NoError(t, err)
		require.Empty(t, out)
	})

	t.Run("error reading secure values is returned", func(t *testing.T) {
		// Set 'secure' to an unsupported type so GetSecureValues fails.
		u := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"namespace": "ns"},
			"secure":   42,
		}}
		obj, err := utils.MetaAccessor(u)
		require.NoError(t, err)

		_, err = GetDecryptedSecureJSONLoader(context.Background(), obj, &stubDecrypter{})
		require.Error(t, err)
	})

	t.Run("secure values present but no decrypter errors", func(t *testing.T) {
		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
			"token": {Name: "secret-token"},
		})
		_, err := GetDecryptedSecureJSONLoader(context.Background(), obj, nil)
		require.ErrorContains(t, err, "no decrypter configured")
	})

	t.Run("missing secure value name surfaces during construction", func(t *testing.T) {
		obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
			"token": {Name: ""},
		})
		_, err := GetDecryptedSecureJSONLoader(context.Background(), obj, &stubDecrypter{})
		require.ErrorContains(t, err, "missing secure value name")
		require.ErrorContains(t, err, "token")
	})
}

func TestDecryptLoader_Success(t *testing.T) {
	val := secretv1beta1.NewExposedSecureValue("super-secret")
	dec := &stubDecrypter{
		results: map[string]decrypt.DecryptResult{
			"secret-token": decrypt.NewDecryptResultValue(&val),
		},
	}

	obj := newTestObject(t, "myns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token": {Name: "secret-token"},
	})

	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	out, err := loader(context.Background())
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "super-secret"}, out)

	require.Equal(t, 1, dec.calls)
	require.Equal(t, "something.grafana.app", dec.gotGroup)
	require.Equal(t, "myns", dec.gotNamespace)
	require.Equal(t, []string{"secret-token"}, dec.gotNames)
}

func TestDecryptLoader_MultipleValues(t *testing.T) {
	tokenVal := secretv1beta1.NewExposedSecureValue("token-v")
	pwVal := secretv1beta1.NewExposedSecureValue("pw-v")
	dec := &stubDecrypter{
		results: map[string]decrypt.DecryptResult{
			"name-token":    decrypt.NewDecryptResultValue(&tokenVal),
			"name-password": decrypt.NewDecryptResultValue(&pwVal),
		},
	}

	obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token":    {Name: "name-token"},
		"password": {Name: "name-password"},
	})

	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	out, err := loader(context.Background())
	require.NoError(t, err)
	require.Equal(t, map[string]string{
		"token":    "token-v",
		"password": "pw-v",
	}, out)

	// Both ref names were forwarded; map iteration order isn't stable, so
	// compare as a set.
	require.ElementsMatch(t, []string{"name-token", "name-password"}, dec.gotNames)
}

func TestDecryptLoader_DecrypterErrorPropagated(t *testing.T) {
	dec := &stubDecrypter{err: errors.New("boom")}

	obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token": {Name: "secret-token"},
	})
	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	_, err = loader(context.Background())
	require.ErrorContains(t, err, "error decrypting secure values")
	require.ErrorContains(t, err, "boom")
}

func TestDecryptLoader_MissingResultForName(t *testing.T) {
	dec := &stubDecrypter{
		// Decrypter returns no entry for the requested name.
		results: map[string]decrypt.DecryptResult{},
	}

	obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token": {Name: "secret-token"},
	})
	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	_, err = loader(context.Background())
	require.ErrorContains(t, err, "unable to find secure value")
	require.ErrorContains(t, err, "secret-token")
	require.ErrorContains(t, err, "token")
}

func TestDecryptLoader_PerValueErrorPropagated(t *testing.T) {
	dec := &stubDecrypter{
		results: map[string]decrypt.DecryptResult{
			"secret-token": decrypt.NewDecryptResultErr(errors.New("forbidden")),
		},
	}

	obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token": {Name: "secret-token"},
	})
	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	_, err = loader(context.Background())
	require.ErrorContains(t, err, "error decrypting secure value")
	require.ErrorContains(t, err, "token")
	require.ErrorContains(t, err, "forbidden")
}

func TestDecryptLoader_NilValueIsSkipped(t *testing.T) {
	// A successful result with no value attached should not appear in the
	// decrypted map (and must not panic on DangerouslyExposeAndConsumeValue).
	dec := &stubDecrypter{
		results: map[string]decrypt.DecryptResult{
			"secret-token": decrypt.NewDecryptResultValue(nil),
		},
	}

	obj := newTestObject(t, "ns", testAPIVersion, "DataSource", common.InlineSecureValues{
		"token": {Name: "secret-token"},
	})
	loader, err := GetDecryptedSecureJSONLoader(context.Background(), obj, dec)
	require.NoError(t, err)

	out, err := loader(context.Background())
	require.NoError(t, err)
	require.Empty(t, out)
}

func TestDecryptLoader_GroupAndNamespaceFromTypedObject(t *testing.T) {
	// Use a typed runtime.Object so GetGroupVersionKind takes the runtime path.
	val := secretv1beta1.NewExposedSecureValue("v")
	dec := &stubDecrypter{
		results: map[string]decrypt.DecryptResult{
			"n": decrypt.NewDecryptResultValue(&val),
		},
	}

	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(schema.GroupVersionKind{Group: "g.example.com", Version: "v1", Kind: "Thing"})
	u.SetNamespace("ns-1")
	u.Object["secure"] = common.InlineSecureValues{"k": {Name: "n"}}

	meta, err := utils.MetaAccessor(u)
	require.NoError(t, err)

	loader, err := GetDecryptedSecureJSONLoader(context.Background(), meta, dec)
	require.NoError(t, err)
	_, err = loader(context.Background())
	require.NoError(t, err)
	require.Equal(t, "g.example.com", dec.gotGroup)
	require.Equal(t, "ns-1", dec.gotNamespace)
}

// stubDecrypter is a test-only DecryptService that records its inputs and
// returns canned results.
type stubDecrypter struct {
	gotGroup     string
	gotNamespace string
	gotNames     []string
	calls        int
	results      map[string]decrypt.DecryptResult
	err          error
}

func (s *stubDecrypter) Decrypt(_ context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	s.calls++
	s.gotGroup = group
	s.gotNamespace = namespace
	s.gotNames = append([]string(nil), names...)
	if s.err != nil {
		return nil, s.err
	}
	return s.results, nil
}

func newTestObject(t *testing.T, namespace string, apiVersion string, kind string, secure common.InlineSecureValues) utils.GrafanaMetaAccessor {
	t.Helper()
	obj := map[string]any{
		"apiVersion": apiVersion,
		"kind":       kind,
		"metadata": map[string]any{
			"namespace": namespace,
		},
		"spec": map[string]any{
			"hello": "world",
		},
	}
	if secure != nil {
		// Store as the typed map; GetSecureValues handles the direct cast path.
		obj["secure"] = secure
	}
	u := &unstructured.Unstructured{Object: obj}
	meta, err := utils.MetaAccessor(u)
	require.NoError(t, err)
	return meta
}
