package reststorage

import (
	"fmt"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
)

func TestValidateSecureValue(t *testing.T) {
	t.Run("when creating a new securevalue", func(t *testing.T) {
		validSecureValue := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Title:     "title",
				Value:     "value",
				Keeper:    "keeper",
				Audiences: []string{"group1/*", "group2/name"},
			},
		}

		t.Run("the `title` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Title = ""

			errs := ValidateSecureValue(sv, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.title", errs[0].Field)
		})

		t.Run("the `keeper` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Keeper = ""

			errs := ValidateSecureValue(sv, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.keeper", errs[0].Field)
		})

		t.Run("either a `value` or `ref` must be present but not both", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Value = ""
			sv.Spec.Ref = ""

			errs := ValidateSecureValue(sv, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)

			sv.Spec.Value = "value"
			sv.Spec.Ref = "value"

			errs = ValidateSecureValue(sv, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})

		t.Run("`audiences` must be present", func(t *testing.T) {
			sv := validSecureValue.DeepCopy()
			sv.Spec.Audiences = make([]string, 0)

			errs := ValidateSecureValue(sv, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.audiences", errs[0].Field)
		})
	})

	t.Run("when updating a securevalue", func(t *testing.T) {
		t.Run("both `value` and `ref` must not be present", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Value: "value",
					Ref:   "value",
				},
			}

			errs := ValidateSecureValue(sv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec", errs[0].Field)
		})
	})

	t.Run("`audiences` must have unique items", func(t *testing.T) {
		t.Run("with regular group-names", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Audiences: []string{
						"my.grafana.app/app-1",
						"my.grafana.app/app-1",
						"my.grafana.app/app-2",
					},
				},
			}

			errs := ValidateSecureValue(sv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.audiences.[1]", errs[0].Field)
		})

		t.Run("with the wildcard name", func(t *testing.T) {
			sv := &secretv0alpha1.SecureValue{
				Spec: secretv0alpha1.SecureValueSpec{
					Audiences: []string{
						"my.grafana.app/*",
						"my.grafana.app/*",
					},
				},
			}

			errs := ValidateSecureValue(sv, admission.Update)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.audiences.[1]", errs[0].Field)
		})
	})

	t.Run("`audiences` must match the expected format", func(t *testing.T) {
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Audiences: []string{
					"/app-name",       // Missing Group
					"my.grafana.app/", // Missing Name
					"my.grafana.app",  // Missing Name + /
				},
			},
		}

		errs := ValidateSecureValue(sv, admission.Update)
		require.Len(t, errs, 3)

		for i, err := range errs {
			require.Equal(t, fmt.Sprintf("spec.audiences.[%d]", i), err.Field)
		}
	})

	t.Run("`audiences` with redundant group-names are reported", func(t *testing.T) {
		sv := &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Audiences: []string{
					// "app-1" and "app-2" lines are not needed as "*" takes precedence for the whole group.
					"my.grafana.app/app-1",
					"my.grafana.app/*",
					"my.grafana.app/app-2",
				},
			},
		}

		errs := ValidateSecureValue(sv, admission.Update)
		require.Len(t, errs, 2)

		actualBadValues := make([]string, 0, 2)
		for _, err := range errs {
			actualBadValues = append(actualBadValues, err.BadValue.(string))
		}
		require.EqualValues(t, []string{"my.grafana.app/app-1", "my.grafana.app/app-2"}, actualBadValues)
	})
}
