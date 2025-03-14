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
		validSecureValue := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Title:      "title",
				Value:      "value",
				Keeper:     "keeper",
				Decrypters: []string{"actor_app1", "actor_app2"},
			},
		}

		t.Run("the `title` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Title = ""

			errs := ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.title", errs[0].Field)
		})

		t.Run("the `keeper` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Keeper = ""

			errs := ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.keeper", errs[0].Field)
		})

		t.Run("either a `value` or `ref` must be present but not both", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = ""
			sv.Spec.Ref = ""

			errs := ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			sv.Spec.Value = "value"
			sv.Spec.Ref = "value"

			errs = ValidateSecureValue(sv, nil, admission.Create, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})
	})

	t.Run("when updating a securevalue", func(t *testing.T) {
		t.Run("when trying to switch from a `value` (old) to a `ref` (new), it returns an error", func(t *testing.T) {
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: "", // empty `ref` means a `value` was present.
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: "ref",
				},
			}

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("when trying to switch from a `ref` (old) to a `value` (new), it returns an error", func(t *testing.T) {
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: "non-empty",
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
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Ref: "non-empty",
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "value",
					Ref:   "ref",
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
					Title: "old-title",
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Title: "new-title",
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
			oldSv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Keeper: "a-keeper",
				},
			}

			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Keeper: "another-keeper",
				},
			}

			errs := ValidateSecureValue(sv, oldSv, admission.Update, nil)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})
	})

	t.Run("`decrypters` must have unique items", func(t *testing.T) {
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Title: "title", Keeper: "keeper", Ref: "ref",

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
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Title: "title", Keeper: "keeper", Ref: "ref",

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
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Title: "title", Keeper: "keeper", Ref: "ref",

					Decrypters: []string{"actor_app3"},
				},
			}

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Len(t, errs, 1)
		})

		t.Run("no decrypters, returns no error", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Title: "title", Keeper: "keeper", Ref: "ref",

					Decrypters: []string{},
				},
			}

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})

		t.Run("one match, returns no errors", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Title: "title", Keeper: "keeper", Ref: "ref",

					Decrypters: []string{decrypters[0]},
				},
			}

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})

		t.Run("all matches, returns no errors", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Title: "title", Keeper: "keeper", Ref: "ref",

					Decrypters: decrypters,
				},
			}

			errs := ValidateSecureValue(sv, nil, admission.Create, allowList)
			require.Empty(t, errs)
		})
	})
}
