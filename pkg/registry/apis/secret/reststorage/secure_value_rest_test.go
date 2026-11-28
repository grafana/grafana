package reststorage

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestSecureValueRestValidation(t *testing.T) {
	t.Parallel()
	rest := createSecureValueRest(testutils.Sut{SecureValueService: &service.SecureValueService{}})

	t.Run("listing with an empty namespace", func(t *testing.T) {
		t.Parallel()
		ctx := request.WithNamespace(t.Context(), "")

		result, err := rest.List(ctx, &internalversion.ListOptions{})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.EqualError(t, err, contracts.ErrSecureValueNamespaceEmpty.Error())
		require.Nil(t, result)
	})

	t.Run("reading with an empty namespace", func(t *testing.T) {
		t.Parallel()
		ctx := request.WithNamespace(t.Context(), "")

		result, err := rest.Get(ctx, "sv1", nil)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.EqualError(t, err, contracts.ErrSecureValueNamespaceEmpty.Error())
		require.Nil(t, result)
	})

	t.Run("reading with an empty name", func(t *testing.T) {
		t.Parallel()
		ctx := request.WithNamespace(t.Context(), "ns1")

		result, err := rest.Get(ctx, "", nil)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.EqualError(t, err, contracts.ErrSecureValueNameEmpty.Error())
		require.Nil(t, result)
	})

	t.Run("deleting with an empty namespace", func(t *testing.T) {
		t.Parallel()
		ctx := request.WithNamespace(t.Context(), "")

		result, deleted, err := rest.Delete(ctx, "sv1", nil, nil)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.EqualError(t, err, contracts.ErrSecureValueNamespaceEmpty.Error())
		require.Nil(t, result)
		require.False(t, deleted)
	})

	t.Run("deleting with an empty name", func(t *testing.T) {
		t.Parallel()
		ctx := request.WithNamespace(t.Context(), "ns1")

		result, deleted, err := rest.Delete(ctx, "", nil, nil)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.EqualError(t, err, contracts.ErrSecureValueNameEmpty.Error())
		require.Nil(t, result)
		require.False(t, deleted)
	})
}

func TestIntegrationSecureValueRest_List_FieldSelector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Parallel()

	t.Run("list with no field selector returns all", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)

		// Create auth context
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValues
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"synthetic-monitoring", "grafana"},
			},
		}))
		require.NoError(t, err)

		sv2, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Call List with no field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{})
		require.NoError(t, err)

		// Assert results
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name, sv2.Name}, actualNames)
	})

	t.Run("list with filter by synthetic-monitoring decrypter", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValues
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"synthetic-monitoring", "grafana"},
			},
		}))
		require.NoError(t, err)

		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		sv3, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret3", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 3",
				Value:       new(secretv1beta1.NewExposedSecureValue("value3")),
				Decrypters:  []string{"synthetic-monitoring", "provisioning"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field selector
		selector, err := fields.ParseSelector("spec.decrypter=synthetic-monitoring")
		require.NoError(t, err)

		// Call List with field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		// Assert results
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name, sv3.Name}, actualNames)
	})

	t.Run("filter by grafana decrypter", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValues
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"synthetic-monitoring", "grafana"},
			},
		}))
		require.NoError(t, err)

		sv2, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret3", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 3",
				Value:       new(secretv1beta1.NewExposedSecureValue("value3")),
				Decrypters:  []string{"synthetic-monitoring", "provisioning"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field selector
		selector, err := fields.ParseSelector("spec.decrypter=grafana")
		require.NoError(t, err)

		// Call List with field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		// Assert results
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name, sv2.Name}, actualNames)
	})

	t.Run("filter by non-existent decrypter returns empty", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValue
		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field selector for non-existent decrypter
		selector, err := fields.ParseSelector("spec.decrypter=nonexistent")
		require.NoError(t, err)

		// Call List with field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		// Assert results
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		assert.Empty(t, resultList.Items)
	})

	t.Run("combine field selector with label selector", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValues with labels
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret1",
				Namespace: "default",
				Labels:    map[string]string{"env": "prod"},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret2",
				Namespace: "default",
				Labels:    map[string]string{"env": "dev"},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field and label selectors
		fieldSelector, err := fields.ParseSelector("spec.decrypter=grafana")
		require.NoError(t, err)
		labelSelector, err := labels.Parse("env=prod")
		require.NoError(t, err)

		// Call List with both selectors
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: fieldSelector,
			LabelSelector: labelSelector,
		})
		require.NoError(t, err)

		// Assert results
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("field selector excludes empty decrypters", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValues
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field selector
		selector, err := fields.ParseSelector("spec.decrypter=grafana")
		require.NoError(t, err)

		// Call List with field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		// Assert results - only sv1 should be returned
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("case sensitive matching", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create test SecureValue with lowercase decrypter
		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Create field selector with uppercase (should not match)
		selector, err := fields.ParseSelector("spec.decrypter=Grafana")
		require.NoError(t, err)

		// Call List with field selector
		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		// Assert results - should be empty due to case mismatch
		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		assert.Empty(t, resultList.Items)
	})

	t.Run("securevalue with multiple decrypters matches single filter", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with multiple decrypters
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6", "grafana", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue without the filter decrypter
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by k6 - should return only sv1
		selector, err := fields.ParseSelector("spec.decrypter=k6")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("filter matches multiple securevalues", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create multiple SecureValues with the same decrypter
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6", "grafana"},
			},
		}))
		require.NoError(t, err)

		sv2, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"k6"},
			},
		}))
		require.NoError(t, err)

		sv3, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret3", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 3",
				Value:       new(secretv1beta1.NewExposedSecureValue("value3")),
				Decrypters:  []string{"k6", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create one without k6
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret4", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 4",
				Value:       new(secretv1beta1.NewExposedSecureValue("value4")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by k6 - should return sv1, sv2, sv3
		selector, err := fields.ParseSelector("spec.decrypter=k6")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name, sv2.Name, sv3.Name}, actualNames)
	})

	t.Run("empty string decrypter filter", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with non-empty decrypters
		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 1",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with empty decrypters array
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Test 2",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by empty string - should return nothing
		selector, err := fields.ParseSelector("spec.decrypter=")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		// Empty string won't match any decrypter
		assert.Empty(t, resultList.Items)
	})

	t.Run("multiple field selectors - AND logic", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with both k6 and grafana
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has both k6 and grafana",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6", "grafana", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with only k6
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has only k6",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"k6", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with only grafana
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret3", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has only grafana",
				Value:       new(secretv1beta1.NewExposedSecureValue("value3")),
				Decrypters:  []string{"grafana", "synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with neither
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret4", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has neither",
				Value:       new(secretv1beta1.NewExposedSecureValue("value4")),
				Decrypters:  []string{"synthetic-monitoring"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by BOTH k6 AND grafana - should return only sv1
		selector, err := fields.ParseSelector("spec.decrypter=k6,spec.decrypter=grafana")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("multiple field selectors - three decrypters", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with all three
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has all three",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6", "grafana", "synthetic-monitoring", "extra"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with only two
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has only k6 and grafana",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"k6", "grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by THREE decrypters - should return only sv1
		selector, err := fields.ParseSelector("spec.decrypter=k6,spec.decrypter=grafana,spec.decrypter=synthetic-monitoring")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("multiple field selectors combined with label selector", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with both decrypters and prod label
		sv1, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret1",
				Namespace: "default",
				Labels:    map[string]string{"env": "prod"},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Prod with both decrypters",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6", "grafana"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with both decrypters but dev label
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret2",
				Namespace: "default",
				Labels:    map[string]string{"env": "dev"},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Dev with both decrypters",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"k6", "grafana"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with prod label but only one decrypter
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret3",
				Namespace: "default",
				Labels:    map[string]string{"env": "prod"},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Prod with only k6",
				Value:       new(secretv1beta1.NewExposedSecureValue("value3")),
				Decrypters:  []string{"k6"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by both decrypters AND prod label - should return only sv1
		fieldSelector, err := fields.ParseSelector("spec.decrypter=k6,spec.decrypter=grafana")
		require.NoError(t, err)
		labelSelector, err := labels.Parse("env=prod")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: fieldSelector,
			LabelSelector: labelSelector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		actualNames := getNames(resultList.Items)
		assert.ElementsMatch(t, []string{sv1.Name}, actualNames)
	})

	t.Run("multiple field selectors - none match all requirements", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)
		authCtx := createAuthContext(ctx, "default")

		// Create SecureValue with only k6
		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has only k6",
				Value:       new(secretv1beta1.NewExposedSecureValue("value1")),
				Decrypters:  []string{"k6"},
			},
		}))
		require.NoError(t, err)

		// Create SecureValue with only grafana
		_, err = sut.CreateSv(authCtx, testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "Has only grafana",
				Value:       new(secretv1beta1.NewExposedSecureValue("value2")),
				Decrypters:  []string{"grafana"},
			},
		}))
		require.NoError(t, err)

		// Create REST handler
		rest := createSecureValueRest(sut)

		// Filter by both k6 AND grafana - should return nothing
		selector, err := fields.ParseSelector("spec.decrypter=k6,spec.decrypter=grafana")
		require.NoError(t, err)

		listCtx := request.WithNamespace(authCtx, "default")
		result, err := rest.List(listCtx, &internalversion.ListOptions{
			FieldSelector: selector,
		})
		require.NoError(t, err)

		resultList, ok := result.(*secretv1beta1.SecureValueList)
		require.True(t, ok)

		// No SecureValue has both decrypters
		assert.Empty(t, resultList.Items)
	})
}

func TestIntegrationSecureValueRest_List_NoNamespaceInContext(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	sut := testutils.Setup(t)

	// Create REST handler
	rest := createSecureValueRest(sut)

	// Context without namespace
	result, err := rest.List(ctx, &internalversion.ListOptions{})
	require.Error(t, err)
	require.Nil(t, result)
	assert.Contains(t, err.Error(), "missing namespace")
}

// Helper functions
func createAuthContext(ctx context.Context, namespace string) context.Context {
	orgID := int64(1)
	requester := &identity.StaticRequester{
		Type:      types.TypeUser,
		Namespace: namespace,
		UserID:    1,
		UserUID:   "test-user",
		OrgID:     orgID,
		// Use legacy Permissions with wildcard scope to grant access to all items
		// LegacyAccessClient.Compile() checks "securevalues:read" action with "securevalues:uid:*" scope
		Permissions: map[int64]map[string][]string{
			orgID: {
				"securevalues:read": {"securevalues:uid:*"},
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

func createSecureValueRest(sut testutils.Sut) *SecureValueRest {
	tracer := noop.NewTracerProvider().Tracer("test")
	resourceInfo := utils.NewResourceInfo(
		secretv1beta1.GroupVersion.Group,
		secretv1beta1.GroupVersion.Version,
		"securevalues",
		"securevalue",
		"SecureValue",
		func() runtime.Object { return &secretv1beta1.SecureValue{} },
		func() runtime.Object { return &secretv1beta1.SecureValueList{} },
		utils.TableColumns{},
	)

	return NewSecureValueRest(tracer, sut.SecureValueService, resourceInfo)
}

func getNames(items []secretv1beta1.SecureValue) []string {
	names := make([]string, len(items))
	for i, item := range items {
		names[i] = item.Name
	}
	return names
}
