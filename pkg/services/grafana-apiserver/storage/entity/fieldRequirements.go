package entity

import (
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
)

const folderAnnoKey = "grafana.app/folder"

type FieldRequirements struct {
	// Equals folder
	Folder *string
}

func ReadFieldRequirements(selector fields.Selector) (FieldRequirements, fields.Selector, error) {
	requirements := FieldRequirements{}

	if selector == nil {
		return requirements, selector, nil
	}

	for _, r := range selector.Requirements() {
		switch r.Field {
		case folderAnnoKey:
			if (r.Operator != selection.Equals) && (r.Operator != selection.DoubleEquals) {
				return requirements, selector, apierrors.NewBadRequest("only equality is supported in the selectors")
			}
			folder := r.Value
			requirements.Folder = &folder
		}
	}

	// use Transform function to remove grafana.app/folder field selector
	selector, err := selector.Transform(func(field, value string) (string, string, error) {
		switch field {
		case folderAnnoKey:
			return "", "", nil
		}
		return field, value, nil
	})

	return requirements, selector, err
}

func RegisterFieldSelectorSupport(scheme *runtime.Scheme) error {
	grafanaFieldSupport := runtime.FieldLabelConversionFunc(
		func(field, value string) (string, string, error) {
			if strings.HasPrefix(field, "grafana.app/") {
				return field, value, nil
			}
			return "", "", getBadSelectorError(field)
		},
	)

	// Register all the internal types
	for gvk := range scheme.AllKnownTypes() {
		if strings.HasSuffix(gvk.Group, ".grafana.app") {
			err := scheme.AddFieldLabelConversionFunc(gvk, grafanaFieldSupport)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func getBadSelectorError(f string) error {
	return apierrors.NewBadRequest(
		fmt.Sprintf("%q is not a known field selector: only %q works", f, folderAnnoKey),
	)
}
