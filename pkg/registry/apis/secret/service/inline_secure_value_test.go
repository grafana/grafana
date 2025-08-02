package service_test

import (
	"testing"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIntegration_InlineSecureValue_CanReference(t *testing.T) {
	t.Parallel()

	tracer := noop.NewTracerProvider().Tracer("test")

	defaultNs := "org-1234"
	owner := common.ObjectReference{
		APIGroup:   "prometheus.datasource.grafana.app",
		APIVersion: "v1alpha1",
		Kind:       "DataSourceConfig",
		Name:       "test-datasource",
		Namespace:  defaultNs,
	}

	t.Run("happy path with owned and shared secure values", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		sv2 := "test-secure-value-2"
		createdSv2, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv2
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv2)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{
			"securevalues:read": {"securevalues:uid:" + sv2},
		})

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.AccessClient)

		err = svc.CanReference(ctx, owner, sv1, sv2)
		require.NoError(t, err)
	})

	t.Run("when the auth info is missing it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)
		err := svc.CanReference(t.Context(), common.ObjectReference{})
		require.Error(t, err)
	})

	t.Run("when the owner namespace does not match auth info namespace it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		reqNs := "org-2345"
		ctx := testutils.CreateUserAuthContext(t.Context(), reqNs, map[string][]string{})

		err := svc.CanReference(ctx, owner)
		require.Error(t, err)
	})

	t.Run("when the owner namespace is empty it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, common.ObjectReference{})
		require.Error(t, err)
	})

	t.Run("when the owner reference has empty fields it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		owner := common.ObjectReference{
			Namespace: defaultNs,
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner)
		require.Error(t, err)

		owner.APIGroup = "prometheus.datasource.grafana.app"
		require.Error(t, svc.CanReference(ctx, owner))
		owner.APIGroup = ""

		owner.APIVersion = "v1alpha1"
		require.Error(t, svc.CanReference(ctx, owner))
		owner.APIVersion = ""

		owner.Kind = "DataSourceConfig"
		require.Error(t, svc.CanReference(ctx, owner))
		owner.Kind = ""

		owner.Name = "test-datasource"
		require.Error(t, svc.CanReference(ctx, owner))
		owner.Name = ""
	})

	t.Run("when no secure values are provided it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner)
		require.Error(t, err)
	})

	t.Run("when the secure value does not exist, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)
		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, "non-existent-sv")
		require.Error(t, err)
	})

	t.Run("when the secure value is owned by a different resource, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		differentOwner := common.ObjectReference{
			APIGroup:   "prometheus.datasource.grafana.app",
			APIVersion: "v1alpha1",
			Kind:       "DataSourceConfig",
			Name:       "different-datasource",
			Namespace:  defaultNs,
		}

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{differentOwner.ToOwnerReference()}
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		err = svc.CanReference(ctx, owner, sv1)
		require.Error(t, err)
	})

	t.Run("when the request identity is not a user nor a service account, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		_, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)

		ctx := identity.WithServiceIdentityContext(t.Context(), 1234)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		err = svc.CanReference(ctx, owner, sv1)
		require.Error(t, err)
	})

	t.Run("when the identity does not have permissions to read the secure value, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		_, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.AccessClient)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{
			"securevalues:read": {"securevalues:uid:another-sv"}, // can read, but another resource!
		})

		err = svc.CanReference(ctx, owner, sv1)
		require.Error(t, err)

		ctx = testutils.CreateUserAuthContext(t.Context(), defaultNs, nil)

		err = svc.CanReference(ctx, owner, sv1)
		require.Error(t, err)
	})
}

func TestIntegration_InlineSecureValue_CreateInline(t *testing.T) {
	t.Parallel()

	tracer := noop.NewTracerProvider().Tracer("test")

	defaultNs := "org-1234"
	owner := common.ObjectReference{
		APIGroup:   "prometheus.datasource.grafana.app",
		APIVersion: "v1alpha1",
		Kind:       "DataSourceConfig",
		Name:       "test-datasource",
		Namespace:  defaultNs,
	}

	t.Run("happy path creates an inline secure value", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		secret := common.NewSecretValue("test-value")

		serviceIdentity := "service-identity"

		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), serviceIdentity, owner.Namespace, nil, nil)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		createdName, err := svc.CreateInline(createAuthCtx, owner, secret)
		require.NoError(t, err)
		require.NotEmpty(t, createdName)

		decryptedValues, err := tu.DecryptService.Decrypt(t.Context(), serviceIdentity, owner.Namespace, []string{createdName})
		require.NoError(t, err)

		decryptedResult, ok := decryptedValues[createdName]
		require.True(t, ok)
		require.Equal(t, decryptedResult.Value().DangerouslyExposeAndConsumeValue(), secret.DangerouslyExposeAndConsumeValue())
	})

	t.Run("when the auth info is missing it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)
		_, err := svc.CreateInline(t.Context(), common.ObjectReference{}, "")
		require.Error(t, err)
	})

	t.Run("when the request identity is not a user nor a service account, it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		createAuthCtx := testutils.CreateServiceAuthContext(t.Context(), "service-identity", defaultNs, nil)

		_, err := svc.CreateInline(createAuthCtx, common.ObjectReference{}, "")
		require.Error(t, err)
	})

	t.Run("when the owner namespace does not match auth info namespace it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		reqNs := "org-2345"
		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), "service-identity", reqNs, nil, nil)

		_, err := svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)
	})

	t.Run("when the owner namespace is empty it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), "service-identity", defaultNs, nil, nil)

		_, err := svc.CreateInline(createAuthCtx, common.ObjectReference{}, "")
		require.Error(t, err)
	})

	t.Run("when the owner reference has empty fields it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		owner := common.ObjectReference{
			Namespace: defaultNs,
		}

		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), "service-identity", defaultNs, nil, nil)

		_, err := svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)

		owner.APIGroup = "prometheus.datasource.grafana.app"
		_, err = svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)

		owner.APIVersion = "v1alpha1"
		_, err = svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)

		owner.Kind = "DataSourceConfig"
		_, err = svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)
		owner.Kind = ""

		owner.Name = "test-datasource"
		_, err = svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)
	})

	t.Run("when an empty secret is provided it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), "service-identity", defaultNs, nil, nil)

		_, err := svc.CreateInline(createAuthCtx, owner, "")
		require.Error(t, err)
	})
}

func TestIntegration_InlineSecureValue_DeleteWhenOwnedByResource(t *testing.T) {
	t.Parallel()

	tracer := noop.NewTracerProvider().Tracer("test")

	defaultNs := "org-1234"
	owner := common.ObjectReference{
		APIGroup:   "prometheus.datasource.grafana.app",
		APIVersion: "v1alpha1",
		Kind:       "DataSourceConfig",
		Name:       "test-datasource",
		Namespace:  defaultNs,
	}

	t.Run("happy path deletes an owned secure value", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		ctx := testutils.CreateServiceAuthContext(t.Context(), "", defaultNs, nil)

		err = svc.DeleteWhenOwnedByResource(ctx, owner, sv1)
		require.NoError(t, err)

		// make sure it got deleted
		sv, err := tu.SecureValueService.Read(ctx, xkube.Namespace(owner.Namespace), sv1)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
		require.Nil(t, sv)
	})

	t.Run("when the auth info is missing it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)
		err := svc.DeleteWhenOwnedByResource(t.Context(), common.ObjectReference{}, "")
		require.Error(t, err)
	})

	t.Run("when the owner namespace does not match auth info namespace it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		reqNs := "org-2345"
		ctx := testutils.CreateUserAuthContext(t.Context(), reqNs, map[string][]string{})

		err := svc.DeleteWhenOwnedByResource(ctx, owner, "")
		require.Error(t, err)
	})

	t.Run("when the owner namespace is empty it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.DeleteWhenOwnedByResource(ctx, common.ObjectReference{}, "")
		require.Error(t, err)
	})

	t.Run("when the owner reference has empty fields it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil)

		owner := common.ObjectReference{
			Namespace: defaultNs,
		}

		createAuthCtx := testutils.CreateOBOAuthContext(t.Context(), "service-identity", defaultNs, nil, nil)

		require.Error(t, svc.DeleteWhenOwnedByResource(createAuthCtx, owner, ""))

		owner.APIGroup = "prometheus.datasource.grafana.app"
		require.Error(t, svc.DeleteWhenOwnedByResource(createAuthCtx, owner, ""))

		owner.APIVersion = "v1alpha1"
		require.Error(t, svc.DeleteWhenOwnedByResource(createAuthCtx, owner, ""))

		owner.Kind = "DataSourceConfig"
		require.Error(t, svc.DeleteWhenOwnedByResource(createAuthCtx, owner, ""))
		owner.Kind = ""

		owner.Name = "test-datasource"
		require.Error(t, svc.DeleteWhenOwnedByResource(createAuthCtx, owner, ""))
	})

	t.Run("when the secure value exists but the owner does not match, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{
				{
					APIVersion: "another.example.com/v0alpha1",
					Kind:       "another-kind",
					Name:       "another-name",
				},
			}
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		ctx := testutils.CreateServiceAuthContext(t.Context(), "", defaultNs, nil)

		err = svc.DeleteWhenOwnedByResource(ctx, owner, sv1)
		require.Error(t, err)

		// make sure it still exists
		sv, err := tu.SecureValueService.Read(ctx, xkube.Namespace(owner.Namespace), sv1)
		require.NoError(t, err)
		require.NotNil(t, sv)
		require.Equal(t, sv1, sv.GetName())
	})

	t.Run("when the secure value exists but it is shared (no owner), it does not return an error (noop)", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil)

		ctx := testutils.CreateServiceAuthContext(t.Context(), "", defaultNs, nil)

		err = svc.DeleteWhenOwnedByResource(ctx, owner, sv1)
		require.NoError(t, err)

		// make sure it still exists
		sv, err := tu.SecureValueService.Read(ctx, xkube.Namespace(owner.Namespace), sv1)
		require.NoError(t, err)
		require.NotNil(t, sv)
		require.Equal(t, sv1, sv.GetName())
	})
}
