package validator

import (
	"errors"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type secureValueValidator struct{}

var _ contracts.SecureValueValidator = &secureValueValidator{}

func ProvideSecureValueValidator() contracts.SecureValueValidator {
	return &secureValueValidator{}
}

func (v *secureValueValidator) Validate(sv, oldSv *secretv1beta1.SecureValue, operation admission.Operation) field.ErrorList {
	errs := make(field.ErrorList, 0)

	// Operation-specific field validation.
	switch operation {
	case admission.Create:
		errs = validateSecureValueCreate(sv)

	// If we plan to support PATCH-style updates, we shouldn't be requiring fields to be set.
	case admission.Update:
		errs = validateSecureValueUpdate(sv, oldSv)

	case admission.Delete:
	case admission.Connect:
	}

	// General validations.
	if err := validation.IsDNS1123Subdomain(sv.Name); len(err) > 0 {
		errs = append(
			errs,
			field.Invalid(field.NewPath("metadata", "name"), sv.Name, strings.Join(err, ",")),
		)

		return errs
	}
	if err := validation.IsDNS1123Subdomain(sv.Namespace); len(err) > 0 {
		errs = append(
			errs,
			field.Invalid(field.NewPath("metadata", "namespace"), sv.Name, strings.Join(err, ",")),
		)

		return errs
	}

	if sv.Spec.Value != nil && len(*sv.Spec.Value) > contracts.SecureValueRawInputMaxSizeBytes {
		errs = append(
			errs,
			field.TooLong(field.NewPath("spec", "value"), len(*sv.Spec.Value), contracts.SecureValueRawInputMaxSizeBytes),
		)
	}

	if errs := validateDecrypters(sv.Spec.Decrypters); len(errs) > 0 {
		return errs
	}

	return errs
}

// validateSecureValueCreate does basic spec validation of a securevalue for the Create operation.
func validateSecureValueCreate(sv *secretv1beta1.SecureValue) field.ErrorList {
	errs := make(field.ErrorList, 0)

	if sv.Spec.Description == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "description"), "a `description` is required"))
	}

	if (sv.Spec.Value == nil || (sv.Spec.Value != nil && *sv.Spec.Value == "")) && (sv.Spec.Ref == nil || (sv.Spec.Ref != nil && *sv.Spec.Ref == "")) {
		errs = append(errs, field.Required(field.NewPath("spec"), "either a `value` or `ref` is required"))
	}

	if (sv.Spec.Value != nil && *sv.Spec.Value != "") && (sv.Spec.Ref != nil && *sv.Spec.Ref != "") {
		errs = append(errs, field.Forbidden(field.NewPath("spec"), "only one of `value` or `ref` can be set"))
	}

	return errs
}

// validateSecureValueUpdate does basic spec validation of a securevalue for the Update operation.
func validateSecureValueUpdate(sv, oldSv *secretv1beta1.SecureValue) field.ErrorList {
	errs := make(field.ErrorList, 0)

	// For updates, an `old` object is required.
	if oldSv == nil {
		errs = append(errs, field.InternalError(field.NewPath("spec"), errors.New("old object is nil")))

		return errs
	}

	// Only validate if one of the fields is being changed/set.
	if (sv.Spec.Value != nil && *sv.Spec.Value != "") || (sv.Spec.Ref != nil && *sv.Spec.Ref != "") {
		if (oldSv.Spec.Ref != nil && *oldSv.Spec.Ref != "") && (sv.Spec.Value != nil && *sv.Spec.Value != "") {
			errs = append(errs, field.Forbidden(field.NewPath("spec"), "cannot set `value` when `ref` was already previously set"))
		}

		if (oldSv.Spec.Ref == nil || (oldSv.Spec.Ref != nil && *oldSv.Spec.Ref == "")) && (sv.Spec.Ref != nil && *sv.Spec.Ref != "") {
			errs = append(errs, field.Forbidden(field.NewPath("spec"), "cannot set `ref` when `value` was already previously set"))
		}
	}

	// Keeper cannot be changed.
	if sv.Spec.Keeper != oldSv.Spec.Keeper {
		errs = append(errs, field.Forbidden(field.NewPath("spec"), "the `keeper` cannot be changed"))
	}

	return errs
}

// validateDecrypters validates that (if populated) the `decrypters` must be unique.
func validateDecrypters(decrypters []string) field.ErrorList {
	errs := make(field.ErrorList, 0)

	// Limit the number of decrypters to 64 to not have it unbounded.
	// The number was chosen arbitrarily and should be enough.
	if len(decrypters) > 64 {
		errs = append(
			errs,
			field.TooMany(field.NewPath("spec", "decrypters"), len(decrypters), 64),
		)

		return errs
	}

	decrypterNames := make(map[string]struct{}, 0)

	for i, decrypter := range decrypters {
		decrypter = strings.TrimSpace(decrypter)
		if decrypter == "" {
			errs = append(
				errs,
				field.Invalid(field.NewPath("spec", "decrypters", "["+strconv.Itoa(i)+"]"), decrypter, "decrypters cannot be empty if specified"),
			)

			continue
		}

		// Use the same validation as labels for the decrypters.
		if verrs := validation.IsValidLabelValue(decrypter); len(verrs) > 0 {
			for _, verr := range verrs {
				errs = append(
					errs,
					field.Invalid(field.NewPath("spec", "decrypters", "["+strconv.Itoa(i)+"]"), decrypter, verr),
				)
			}

			continue
		}

		if _, exists := decrypterNames[decrypter]; exists {
			errs = append(
				errs,
				field.Invalid(field.NewPath("spec", "decrypters", "["+strconv.Itoa(i)+"]"), decrypter, "decrypters must be unique"),
			)

			continue
		}

		decrypterNames[decrypter] = struct{}{}
	}

	return errs
}
