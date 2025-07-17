package validator

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

func TestValidateSecureValue(t *testing.T) {
	objectMeta := metav1.ObjectMeta{Name: "test", Namespace: "test"}
	validator := ProvideSecureValueValidator()

	t.Run("when creating a new securevalue", func(t *testing.T) {
		keeper := "keeper"
		validSecureValue := &secretv1beta1.SecureValue{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.SecureValueSpec{
				Description: "description",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
				Keeper:      &keeper,
				Decrypters:  []string{"app1", "app2"},
			},
		}

		t.Run("the `description` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Description = ""

			errs := validator.Validate(sv, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.description", errs[0].Field)
		})

		t.Run("either a `value` or `ref` must be present but not both", func(t *testing.T) {
			// nil
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = nil
			sv.Spec.Ref = nil

			errs := validator.Validate(sv, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			// empty value
			sv.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue(""))
			sv.Spec.Ref = nil

			errs = validator.Validate(sv, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			// present value and ref
			ref := "value"
			sv.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue("value"))
			sv.Spec.Ref = &ref

			errs = validator.Validate(sv, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("`value` cannot exceed 24576 bytes", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue(strings.Repeat("a", contracts.SECURE_VALUE_RAW_INPUT_MAX_SIZE_BYTES+1)))
			sv.Spec.Ref = nil

			errs := validator.Validate(sv, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.value", errs[0].Field)
		})
	})

	t.Run("when updating a securevalue", func(t *testing.T) {
		t.Run("when trying to switch from a `value` (old) to a `ref` (new), it returns an error", func(t *testing.T) {
			oldSv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Ref: nil, // empty `ref` means a `value` was present.
				},
			}

			ref := "ref"
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Ref: &ref,
				},
			}

			validator := ProvideSecureValueValidator()
			errs := validator.Validate(sv, oldSv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when trying to switch from a `ref` (old) to a `value` (new), it returns an error", func(t *testing.T) {
			ref := "non-empty"
			oldSv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Ref: &ref,
				},
			}

			sv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Value: ptr.To(secretv1beta1.NewExposedSecureValue("value")),
				},
			}

			errs := validator.Validate(sv, oldSv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when both `value` and `ref` are set, it returns an error", func(t *testing.T) {
			refNonEmpty := "non-empty"
			oldSv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Ref: &refNonEmpty,
				},
			}

			ref := "ref"
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Value: ptr.To(secretv1beta1.NewExposedSecureValue("value")),
					Ref:   &ref,
				},
			}

			errs := validator.Validate(sv, oldSv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			oldSv = &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Value: ptr.To(secretv1beta1.NewExposedSecureValue("non-empty")),
				},
			}

			errs = validator.Validate(sv, oldSv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when no changes are made, it returns no errors", func(t *testing.T) {
			oldSv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Description: "old-description",
				},
			}

			sv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Description: "new-description",
				},
			}

			errs := validator.Validate(sv, oldSv, admission.Update)
			require.Empty(t, errs)
		})

		t.Run("when the old object is `nil` it returns an error", func(t *testing.T) {
			sv := &secretv1beta1.SecureValue{ObjectMeta: objectMeta}

			errs := validator.Validate(sv, nil, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when trying to change the `keeper`, it returns an error", func(t *testing.T) {
			keeperA := "a-keeper"
			keeperAnother := "another-keeper"
			oldSv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Keeper: &keeperA,
				},
			}

			sv := &secretv1beta1.SecureValue{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.SecureValueSpec{
					Keeper: &keeperAnother,
				},
			}

			errs := validator.Validate(sv, oldSv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})
	})

	t.Run("`decrypters` must have unique items", func(t *testing.T) {
		ref := "ref"
		sv := &secretv1beta1.SecureValue{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: []string{
					"app1",
					"app1",
				},
			},
		}

		errs := validator.Validate(sv, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters.[1]", errs[0].Field)
	})

	t.Run("`decrypters` list can be empty", func(t *testing.T) {
		ref := "ref"
		sv := &secretv1beta1.SecureValue{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: []string{},
			},
		}

		errs := validator.Validate(sv, nil, admission.Create)
		require.Empty(t, errs)
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
		sv := &secretv1beta1.SecureValue{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: decrypters,
			},
		}

		errs := validator.Validate(sv, nil, admission.Create)
		require.Len(t, errs, 3)
	})

	t.Run("`decrypters` cannot have more than 64 items", func(t *testing.T) {
		decrypters := make([]string, 0, 64+1)
		for i := 0; i < 64+1; i++ {
			decrypters = append(decrypters, fmt.Sprintf("app%d", i))
		}

		ref := "ref"
		sv := &secretv1beta1.SecureValue{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: decrypters,
			},
		}

		errs := validator.Validate(sv, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters", errs[0].Field)
	})
}
