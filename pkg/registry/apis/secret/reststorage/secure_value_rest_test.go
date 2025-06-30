package reststorage_test

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestValidateSecureValue(t *testing.T) {
	t.Run("when creating a new securevalue", func(t *testing.T) {
		keeper := "keeper"
		validSecureValue := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description",
				Value:       "value",
				Keeper:      &keeper,
				Decrypters:  []string{"app1", "app2"},
			},
		}

		t.Run("the `description` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Description = ""

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.description", errs[0].Field)
		})

		t.Run("either a `value` or `ref` must be present but not both", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = ""
			sv.Spec.Ref = nil

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			ref := "value"
			sv.Spec.Value = "value"
			sv.Spec.Ref = &ref

			errs = reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("`value` cannot exceed 24576 bytes", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = secretv0alpha1.NewExposedSecureValue(strings.Repeat("a", contracts.SECURE_VALUE_RAW_INPUT_MAX_SIZE_BYTES+1))
			sv.Spec.Ref = nil

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.value", errs[0].Field)
		})
	})

	t.Run("when updating a securevalue", func(t *testing.T) {
		t.Run("when trying to switch from a `value` (old) to a `ref` (new), it returns an error", func(t *testing.T) {
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: nil, // empty `ref` means a `value` was present.
				},
			}

			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: &ref,
				},
			}

			errs := reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when trying to switch from a `ref` (old) to a `value` (new), it returns an error", func(t *testing.T) {
			ref := "non-empty"
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: &ref,
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "value",
				},
			}

			errs := reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when both `value` and `ref` are set, it returns an error", func(t *testing.T) {
			refNonEmpty := "non-empty"
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: &refNonEmpty,
				},
			}

			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "value",
					Ref:   &ref,
				},
			}

			errs := reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			oldSv = &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "non-empty",
				},
			}

			errs = reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when no changes are made, it returns no errors", func(t *testing.T) {
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "old-description",
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "new-description",
				},
			}

			errs := reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Empty(t, errs)
		})

		t.Run("when the old object is `nil` it returns an error", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{}

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when trying to change the `keeper`, it returns an error", func(t *testing.T) {
			keeperA := "a-keeper"
			keeperAnother := "another-keeper"
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Keeper: &keeperA,
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Keeper: &keeperAnother,
				},
			}

			errs := reststorage.ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})
	})

	t.Run("`decrypters` must have unique items", func(t *testing.T) {
		ref := "ref"
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: []string{
					"app1",
					"app1",
				},
			},
		}

		errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters.[1]", errs[0].Field)
	})

	t.Run("when set, the `decrypters` must be one of the allowed in the allow list", func(t *testing.T) {
		allowList := map[string]struct{}{"app1": {}, "app2": {}}
		decrypters := slices.Collect(maps.Keys(allowList))

		t.Run("no matches, returns an error", func(t *testing.T) {
			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "description", Ref: &ref,

					Decrypters: []string{"app3"},
				},
			}

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Len(t, errs, 1)
		})

		t.Run("no decrypters, returns no error", func(t *testing.T) {
			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "description", Ref: &ref,

					Decrypters: []string{},
				},
			}

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})

		t.Run("one match, returns no errors", func(t *testing.T) {
			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "description", Ref: &ref,

					Decrypters: []string{decrypters[0]},
				},
			}

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})

		t.Run("all matches, returns no errors", func(t *testing.T) {
			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "description", Ref: &ref,

					Decrypters: decrypters,
				},
			}

			errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})
	})

	t.Run("`decrypters` must be a valid label value", func(t *testing.T) {
		decrypters := []string{
			"",              // invalid
			"is/this/valid", // invalid
			"is this valid", // invalid
			"is.this.valid",
			"is-this-valid",
			"is_this_valid",
			"0isthisvalid9",
			"isthisvalid9",
			"0isthisvalid",
			"isthisvalid",
		}

		ref := "ref"
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: decrypters,
			},
		}

		errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, 3)
	})

	t.Run("`decrypters` cannot have more than 64 items", func(t *testing.T) {
		decrypters := make([]string, 0, 64+1)
		for i := 0; i < 64+1; i++ {
			decrypters = append(decrypters, fmt.Sprintf("app%d", i))
		}

		ref := "ref"
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: decrypters,
			},
		}

		errs := reststorage.ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters", errs[0].Field)
	})
}

func TestSecureValueRestCreate(t *testing.T) {
	t.Run("secure values are unique per namespace+name", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		ctx := context.Background()

		sv := &secretv0alpha1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "desc1",
			},
			Status: secretv0alpha1.SecureValueStatus{
				Phase:      secretv0alpha1.SecureValuePhasePending,
				ExternalID: "test-external-id",
			},
		}

		restStorage := reststorage.NewSecureValueRest(
			noop.NewTracerProvider().Tracer("test"),
			sut.SecureValueService,
			secretv0alpha1.SecureValuesResourceInfo,
		)

		ctx = createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues:*"}, types.TypeUser)
		ctx = request.WithNamespace(ctx, sv.Namespace)

		validationFunc := func(_ context.Context, _ runtime.Object) error { return nil }

		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue("v1")
		createdSv, err := restStorage.Create(ctx, sv, validationFunc, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Empty(t, createdSv.(*secretv0alpha1.SecureValue).Status.ExternalID)

		sv.Spec.Value = secretv0alpha1.NewExposedSecureValue("v2")
		_, err = restStorage.Create(ctx, sv, validationFunc, &metav1.CreateOptions{})
		require.ErrorIs(t, err, contracts.ErrSecureValueAlreadyExists)
	})
}

func createAuthContext(ctx context.Context, namespace string, permissions []string, identityType types.IdentityType) context.Context {
	requester := &identity.StaticRequester{
		Type:      identityType,
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: permissions,
			},
		},
	}

	if identityType == types.TypeUser {
		requester.UserID = 1
	}

	return types.WithAuthInfo(ctx, requester)
}
