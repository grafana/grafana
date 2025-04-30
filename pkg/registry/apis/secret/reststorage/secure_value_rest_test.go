package reststorage

import (
	"fmt"
	"maps"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

func TestValidateSecureValue(t *testing.T) {
	t.Run("when creating a new securevalue", func(t *testing.T) {
		keeper := "keeper"

		validSecureValue := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description",
				Value:       "value",
				Keeper:      &keeper,
				Decrypters:  []string{"actor_app1", "actor_app2"},
			},
		}

		t.Run("the `description` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Description = ""

			errs := ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.description", errs[0].Field)
		})

		t.Run("either a `value` or `ref` must be present but not both", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = ""
			sv.Spec.Ref = nil

			errs := ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			ref := "value"
			sv.Spec.Value = "value"
			sv.Spec.Ref = &ref

			errs = ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
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

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
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

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
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

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			oldSv = &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "non-empty",
				},
			}

			errs = ValidateSecureValue(sv, oldSv, admission.Update, nil)
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

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Empty(t, errs)
		})

		t.Run("when the old object is `nil` it returns an error", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{}

			errs := ValidateSecureValue(sv, nil, admission.Update, nil)
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

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
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
					"actor_app1",
					"actor_app1",
				},
			},
		}

		errs := ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters.[1]", errs[0].Field)
	})

	t.Run("`decrypters` must match the expected format", func(t *testing.T) {
		ref := "ref"
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: []string{
					"app1",
					"_app1",
					"actr_app1",
					"actor_ ",
					"actor_",
				},
			},
		}

		errs := ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, len(sv.Spec.Decrypters))

		for i, err := range errs {
			require.Equal(t, fmt.Sprintf("spec.decrypters.[%d]", i), err.Field)
			require.Contains(t, err.Error(), "a decrypter must have the format `actor_{name}`")
		}
	})

	t.Run("when set, the `decrypters` must be one of the allowed in the allow list", func(t *testing.T) {
		allowList := map[string]struct{}{"actor_app1": {}, "actor_app2": {}}
		decrypters := slices.Collect(maps.Keys(allowList))

		t.Run("no matches, returns an error", func(t *testing.T) {
			ref := "ref"
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Description: "description", Ref: &ref,

					Decrypters: []string{"actor_app3"},
				},
			}

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
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

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
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

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
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

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})
	})

	t.Run("`decrypters` cannot have more than 64 items", func(t *testing.T) {
		decrypters := make([]string, 0, 64+1)
		for i := 0; i < 64+1; i++ {
			decrypters = append(decrypters, fmt.Sprintf("actor_app%d", i))
		}

		ref := "ref"
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Description: "description", Ref: &ref,

				Decrypters: decrypters,
			},
		}

		errs := ValidateSecureValue(sv, nil, admission.Create, nil)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.decrypters", errs[0].Field)
	})
}
