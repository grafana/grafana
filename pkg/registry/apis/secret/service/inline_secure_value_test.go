package service_test

import (
	"strconv"
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
		UID:        "12345",
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

		values := common.InlineSecureValues{
			"fieldA": {Name: sv1},
			"fieldB": {Name: sv2},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{
			"securevalues:read": {"securevalues:uid:" + sv2},
		})

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.SecureValueMetadataStorage, tu.AccessClient)

		err = svc.CanReference(ctx, owner, values)
		require.NoError(t, err)
	})

	t.Run("when the auth info is missing it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)
		err := svc.CanReference(t.Context(), common.ObjectReference{}, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner namespace does not match auth info namespace it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		reqNs := "org-2345"
		ctx := testutils.CreateUserAuthContext(t.Context(), reqNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner namespace is empty it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, common.ObjectReference{}, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner reference has empty fields it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		owner := common.ObjectReference{
			Namespace: defaultNs,
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)

		owner.APIGroup = "prometheus.datasource.grafana.app"
		require.Error(t, svc.CanReference(ctx, owner, common.InlineSecureValues{}))
		owner.APIGroup = ""

		owner.APIVersion = "v1alpha1"
		require.Error(t, svc.CanReference(ctx, owner, common.InlineSecureValues{}))
		owner.APIVersion = ""

		owner.Kind = "DataSourceConfig"
		require.Error(t, svc.CanReference(ctx, owner, common.InlineSecureValues{}))
		owner.Kind = ""

		owner.Name = "test-datasource"
		require.Error(t, svc.CanReference(ctx, owner, common.InlineSecureValues{}))
		owner.Name = ""

		owner.UID = "12345"
		require.Error(t, svc.CanReference(ctx, owner, common.InlineSecureValues{}))
		owner.UID = ""
	})

	t.Run("when no secure values are provided it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when one of the secure values does not have a `name`, it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		values := common.InlineSecureValues{
			"fieldA": {Name: ""},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, values)
		require.Error(t, err)
	})

	t.Run("when one of the secure values has `create` field set, it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		values := common.InlineSecureValues{
			"fieldA": {
				Name:   "test-sv",
				Create: common.NewSecretValue("test"),
			},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, values)
		require.Error(t, err)
	})

	t.Run("when one of the secure values has `remove` field set, it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		values := common.InlineSecureValues{
			"fieldA": {
				Name:   "test-sv",
				Remove: true,
			},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, values)
		require.Error(t, err)
	})

	t.Run("when the secure value does not exist, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)
		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil, nil)

		values := common.InlineSecureValues{
			"fieldA": {Name: "non-existent-sv"},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		err := svc.CanReference(ctx, owner, values)
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
			UID:        "67890",
		}

		sv1 := "test-secure-value-1"
		createdSv1, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{differentOwner.ToOwnerReference()}
		})
		require.NoError(t, err)
		require.NotNil(t, createdSv1)

		values := common.InlineSecureValues{
			"fieldA": {Name: sv1},
		}

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil, nil)

		err = svc.CanReference(ctx, owner, values)
		require.Error(t, err)
	})

	t.Run("when the request identity subject is not a user nor a service account, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		sv1 := "test-secure-value-1"
		_, err := tu.CreateSv(t.Context(), func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)

		values := common.InlineSecureValues{
			"fieldA": {Name: sv1},
		}

		ctx := identity.WithServiceIdentityContext(t.Context(), 1234)

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil, nil)

		err = svc.CanReference(ctx, owner, values)
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

		values := common.InlineSecureValues{
			"fieldA": {Name: sv1},
		}

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, nil, tu.AccessClient)

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{
			"securevalues:read": {"securevalues:uid:another-sv"}, // can read, but another resource!
		})

		err = svc.CanReference(ctx, owner, values)
		require.Error(t, err)

		ctx = testutils.CreateUserAuthContext(t.Context(), defaultNs, nil)

		err = svc.CanReference(ctx, owner, values)
		require.Error(t, err)
	})
}

func TestIntegration_InlineSecureValue_UpdateSecureValues(t *testing.T) {
	t.Parallel()

	tracer := noop.NewTracerProvider().Tracer("test")

	defaultOrgID := int64(1234)
	defaultNs := "org-" + strconv.Itoa(int(defaultOrgID))
	owner := common.ObjectReference{
		APIGroup:   "prometheus.datasource.grafana.app",
		APIVersion: "v1alpha1",
		Kind:       "DataSourceConfig",
		Name:       "test-datasource",
		Namespace:  defaultNs,
		UID:        "12345",
	}

	t.Run("with no previous values, it uses the requested data to create/remove/reference the secure values", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)

		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		sv1 := "test-sv-1"
		_, err := tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)

		sv2 := "test-sv-2"
		_, err = tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv2
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)

		sv3 := "test-sv-3"
		_, err = tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv3
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)

		values := common.InlineSecureValues{
			"fieldA": {
				Create: common.NewSecretValue("test-value-a"),
			},
			"fieldB": {
				Name: sv1,
			},
			"fieldC": {
				Name:   sv2,
				Remove: true,
			},
			"fieldD": {
				Name: sv3,
			},
		}

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.SecureValueMetadataStorage, tu.AccessClient)

		newState, err := svc.UpdateSecureValues(ctx, owner, values)
		require.NoError(t, err)
		require.Len(t, newState, 3)

		// Name is set, create is removed
		require.NotEmpty(t, newState["fieldA"].Name)
		require.True(t, newState["fieldA"].Create.IsZero())
		require.False(t, newState["fieldA"].Remove)

		// Can reference owned secure value because the secure value has the same owner reference
		require.Equal(t, sv1, newState["fieldB"].Name)
		require.True(t, newState["fieldB"].Create.IsZero())
		require.False(t, newState["fieldB"].Remove)

		// Removed from the result and deleted from the storage
		fieldC, ok := newState["fieldC"]
		require.False(t, ok)
		require.Empty(t, fieldC)
		_, err = tu.SecureValueService.Read(ctx, xkube.Namespace(defaultNs), sv2)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)

		// Can reference shared secure value because the user has permissions
		require.Equal(t, sv3, newState["fieldD"].Name)
		require.True(t, newState["fieldD"].Create.IsZero())
		require.False(t, newState["fieldD"].Remove)
	})

	t.Run("with an invalid combination of inputs, it returns an error", func(t *testing.T) {
		t.Parallel()

		tu := testutils.Setup(t)
		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.SecureValueMetadataStorage, tu.AccessClient)

		// With three options, we have 2^3 combinations, and 5 of them are invalid states.
		// The remaining 3 valid ones: create without name / just name / remove with name.
		empty := common.InlineSecureValues{"empty": {}}
		removeWithoutName := common.InlineSecureValues{
			"remove-without-name": {Remove: true},
		}
		createWithRemove := common.InlineSecureValues{
			"create-with-remove": {
				Create: common.NewSecretValue("test-value-a"),
				Remove: true,
			},
		}
		createWithName := common.InlineSecureValues{
			"create-with-name": {
				Create: common.NewSecretValue("test-value-a"),
				Name:   "passing-a-name-not-allowed",
			},
		}
		createAndRemoveWithName := common.InlineSecureValues{
			"create-and-remove-with-name": {
				Create: common.NewSecretValue("test-value-a"),
				Name:   "passing-a-name-not-allowed",
				Remove: true,
			},
		}

		for _, values := range []common.InlineSecureValues{
			empty,
			removeWithoutName,
			createWithRemove,
			createWithName,
			createAndRemoveWithName,
		} {
			newState, err := svc.UpdateSecureValues(ctx, owner, values)
			require.Error(t, err)
			require.Empty(t, newState)
		}
	})

	t.Run("when there's existing secure values owned by the resource which are no longer referenced, they are deleted", func(t *testing.T) {
		tu := testutils.Setup(t)

		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		sv1 := "test-sv-1"
		_, err := tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)

		sv2 := "test-sv-2"
		_, err = tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv2
			cfg.Sv.Namespace = defaultNs
			cfg.Sv.OwnerReferences = []metav1.OwnerReference{owner.ToOwnerReference()}
		})
		require.NoError(t, err)

		values := common.InlineSecureValues{
			"fieldA": {
				Create: common.NewSecretValue("test-value-a"),
			},
			"fieldB": {
				Name: sv1,
			},
		}

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.SecureValueMetadataStorage, tu.AccessClient)

		newState, err := svc.UpdateSecureValues(ctx, owner, values)
		require.NoError(t, err)
		require.Len(t, newState, 2)

		_, err = tu.SecureValueService.Read(ctx, xkube.Namespace(defaultNs), sv2)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	})

	t.Run("when trying to remove a secure value that is not owned by the resource, it returns an error", func(t *testing.T) {
		tu := testutils.Setup(t)

		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		sv1 := "test-sv-1"
		_, err := tu.CreateSv(ctx, func(cfg *testutils.CreateSvConfig) {
			cfg.Sv.Name = sv1
			cfg.Sv.Namespace = defaultNs
		})
		require.NoError(t, err)

		values := common.InlineSecureValues{
			"fieldA": {
				Name:   sv1,
				Remove: true,
			},
		}

		svc := service.ProvideInlineSecureValueService(tracer, tu.SecureValueService, tu.SecureValueMetadataStorage, tu.AccessClient)

		newState, err := svc.UpdateSecureValues(ctx, owner, values)
		require.Error(t, err)
		require.Empty(t, newState)
	})

	t.Run("when the auth info is missing it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		_, err := svc.UpdateSecureValues(t.Context(), common.ObjectReference{}, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when there is no service identity in the context, it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx := testutils.CreateUserAuthContext(t.Context(), defaultNs, map[string][]string{})

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		_, err := svc.UpdateSecureValues(ctx, common.ObjectReference{}, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner namespace does not match auth info namespace it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx := testutils.CreateOBOAuthContext(t.Context(), 2345, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		_, err := svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner namespace is empty it returns an error", func(t *testing.T) {
		t.Parallel()

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		_, err := svc.UpdateSecureValues(ctx, common.ObjectReference{}, common.InlineSecureValues{})
		require.Error(t, err)
	})

	t.Run("when the owner reference has empty fields it returns an error", func(t *testing.T) {
		t.Parallel()

		owner := common.ObjectReference{
			Namespace: defaultNs,
		}

		ctx := testutils.CreateOBOAuthContext(t.Context(), defaultOrgID, 1, "service-identity-name", map[string][]string{
			"securevalues:read": {"securevalues:uid:*"},
		})

		svc := service.ProvideInlineSecureValueService(tracer, nil, nil, nil)

		_, err := svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)

		owner.APIGroup = "prometheus.datasource.grafana.app"
		_, err = svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
		owner.APIGroup = ""

		owner.APIVersion = "v1alpha1"
		_, err = svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
		owner.APIVersion = ""

		owner.Kind = "DataSourceConfig"
		_, err = svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
		owner.Kind = ""

		owner.Name = "test-datasource"
		_, err = svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
		owner.Name = ""

		owner.UID = "12345"
		_, err = svc.UpdateSecureValues(ctx, owner, common.InlineSecureValues{})
		require.Error(t, err)
		owner.UID = ""
	})
}
