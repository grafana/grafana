package entity

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
)

const folderAnnoKey = "grafana.app/folder"
const sortByKey = "grafana.app/sortBy"

type Requirements struct {
	// Equals folder
	Folder *string
	// SortBy is a list of fields to sort by
	SortBy []string
}

func ReadLabelSelectors(selector labels.Selector) (Requirements, labels.Selector, error) {
	requirements := Requirements{}
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
		// add all unregonized label selectors to the new selector list, these will be processed by the entity store
		default:
			newSelector = newSelector.Add(r)
		}
	}

	return requirements, newSelector, nil
}
