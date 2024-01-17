package entity

import (
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
)

const folderAnnoKey = "grafana.app/folder"
const sortByKey = "grafana.app/sortBy"

type FieldRequirements struct {
	// Equals folder
	Folder *string
	// SortBy is a list of fields to sort by
	SortBy []string
}

func ReadFieldRequirements(selector labels.Selector) (FieldRequirements, labels.Selector, error) {
	requirements := FieldRequirements{}
	newSelector := labels.NewSelector()

	if selector == nil {
		return requirements, newSelector, nil
	}

	labelSelectors, _ := selector.Requirements()

	for _, r := range labelSelectors {
		switch r.Key() {
		case folderAnnoKey:
			if (r.Operator() != selection.Equals) && (r.Operator() != selection.DoubleEquals) {
				return requirements, newSelector, apierrors.NewBadRequest(folderAnnoKey + " label selector only supports equality")
			}
			folder := r.Values().List()[0]
			requirements.Folder = &folder
		case sortByKey:
			if r.Operator() != selection.In {
				return requirements, newSelector, apierrors.NewBadRequest(sortByKey + " label selector only supports in")
			}
			requirements.SortBy = r.Values().List()
		default:
			newSelector = newSelector.Add(r)
		}
	}

	return requirements, newSelector, nil
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
