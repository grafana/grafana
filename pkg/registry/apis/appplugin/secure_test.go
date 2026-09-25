package appplugin

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestSecureValueLookupCache(t *testing.T) {
	calls := 0
	lookup := newSecureValueLookup(secureLookupDecrypter(func(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
		calls++
		require.Equal(t, "test.grafana.app", group)
		require.Equal(t, "test-namespace", namespace)
		require.Equal(t, []string{"secret-token"}, names)
		return secureLookupResults(fmt.Sprintf("value-%d", calls)), nil
	}))
	for _, tc := range []struct {
		uid, rv, value string
		calls          int
	}{
		{"first", "1", "value-1", 1},
		{"first", "1", "value-1", 1},
		{"second", "1", "value-2", 2},
		{"first", "2", "value-3", 3},
		{"first", "1", "value-1", 3},
	} {
		got, err := lookup.get(t.Context(), secureLookupObject(t, tc.uid, tc.rv))
		require.NoError(t, err)
		require.Equal(t, map[string]string{"token": tc.value}, got)
		require.Equal(t, tc.calls, calls)
	}
}

func TestSecureValueLookupValidation(t *testing.T) {
	for _, tc := range []struct {
		name      string
		secure    any
		rv        string
		decrypter bool
		wantErr   string
	}{
		{name: "no secure values needs neither decrypter nor version"},
		{name: "empty secure values", secure: map[string]any{}},
		{name: "malformed secure values", secure: 42, wantErr: "secure"},
		{name: "missing decrypter", secure: map[string]any{"token": map[string]any{"name": "secret-token"}}, rv: "1", wantErr: "missing decrypter"},
		{name: "missing version", secure: map[string]any{"token": map[string]any{"name": "secret-token"}}, decrypter: true, wantErr: "missing rv"},
		{name: "missing secret name", secure: map[string]any{"token": map[string]any{}}, rv: "1", decrypter: true, wantErr: "missing secure value name"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var dec decrypt.DecryptService
			if tc.decrypter {
				dec = secureLookupDecrypter(func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error) {
					t.Fatal("validation must not call decrypter")
					return nil, nil
				})
			}
			obj := &unstructured.Unstructured{Object: map[string]any{"metadata": map[string]any{"resourceVersion": tc.rv}}}
			if tc.secure != nil {
				obj.Object["secure"] = tc.secure
			}
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			got, err := newSecureValueLookup(dec).get(t.Context(), meta)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
			}
			require.Nil(t, got)
		})
	}
}

func TestSecureValueLookupRetriesErrors(t *testing.T) {
	failure := errors.New("decrypt failed")
	for _, tc := range []struct {
		name    string
		results map[string]decrypt.DecryptResult
		err     error
		wantErr string
	}{
		{name: "service error", err: failure, wantErr: "decrypt failed"},
		{name: "per-value error", results: map[string]decrypt.DecryptResult{"secret-token": decrypt.NewDecryptResultErr(failure)}, wantErr: "decrypt failed"},
		{name: "missing result", results: map[string]decrypt.DecryptResult{}, wantErr: "unable to find secure value"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			lookup := newSecureValueLookup(secureLookupDecrypter(func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error) {
				calls++
				if calls == 1 {
					return tc.results, tc.err
				}
				return secureLookupResults("recovered"), nil
			}))
			obj := secureLookupObject(t, "uid", "1")
			got, err := lookup.get(t.Context(), obj)
			require.ErrorContains(t, err, tc.wantErr)
			require.Nil(t, got)
			for range 2 {
				got, err = lookup.get(t.Context(), obj)
				require.NoError(t, err)
				require.Equal(t, map[string]string{"token": "recovered"}, got)
			}
			require.Equal(t, 2, calls)
		})
	}
}

func TestSecureValueLookupContext(t *testing.T) {
	type contextKey struct{}
	calls := 0
	lookup := newSecureValueLookup(secureLookupDecrypter(func(ctx context.Context, _, _ string, _ ...string) (map[string]decrypt.DecryptResult, error) {
		calls++
		require.Equal(t, "request-value", ctx.Value(contextKey{}))
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return secureLookupResults("value"), nil
	}))
	ctx := context.WithValue(t.Context(), contextKey{}, "request-value")
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	obj := secureLookupObject(t, "uid", "1")
	_, err := lookup.get(canceled, obj)
	require.ErrorIs(t, err, context.Canceled)
	got, err := lookup.get(ctx, obj)
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "value"}, got)
	require.Equal(t, 2, calls)
}

func TestSecureValueLookupEviction(t *testing.T) {
	calls := 0
	lookup := newSecureValueLookup(secureLookupDecrypter(func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error) {
		calls++
		return secureLookupResults(fmt.Sprintf("value-%d", calls)), nil
	}))
	for i := range 100 {
		_, err := lookup.get(t.Context(), secureLookupObject(t, fmt.Sprint(i), "1"))
		require.NoError(t, err)
	}
	_, err := lookup.get(t.Context(), secureLookupObject(t, "0", "1"))
	require.NoError(t, err)
	_, err = lookup.get(t.Context(), secureLookupObject(t, "100", "1"))
	require.NoError(t, err)
	got, err := lookup.get(t.Context(), secureLookupObject(t, "0", "1"))
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "value-1"}, got)
	require.Equal(t, 101, calls)
	got, err = lookup.get(t.Context(), secureLookupObject(t, "1", "1"))
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "value-102"}, got)
	require.Equal(t, 102, calls)
}

func TestSecureValueLookupLoaderIsLazy(t *testing.T) {
	calls := 0
	lookup := newSecureValueLookup(secureLookupDecrypter(func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error) {
		calls++
		return secureLookupResults("value"), nil
	}))
	loader, err := lookup.loader(t.Context(), secureLookupObject(t, "uid", "1"))
	require.NoError(t, err)
	require.Zero(t, calls)
	got, err := loader(t.Context())
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "value"}, got)
	require.Equal(t, 1, calls)
}

type secureLookupDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (f secureLookupDecrypter) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, group, namespace, names...)
}

func secureLookupResults(value string) map[string]decrypt.DecryptResult {
	exposed := secretv1beta1.NewExposedSecureValue(value)
	return map[string]decrypt.DecryptResult{"secret-token": decrypt.NewDecryptResultValue(&exposed)}
}

func secureLookupObject(t *testing.T, uid, rv string) utils.GrafanaMetaAccessor {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "test.grafana.app/v1", "kind": "Thing",
		"metadata": map[string]any{"uid": uid, "resourceVersion": rv, "namespace": "test-namespace"},
		"secure":   map[string]any{"token": map[string]any{"name": "secret-token"}},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	return meta
}
