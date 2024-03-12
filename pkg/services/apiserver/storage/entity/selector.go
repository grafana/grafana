package entity

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
)

const folderAnnoKey = "grafana.app/folder"
const sortByKey = "grafana.app/sortBy"
const listDeletedKey = "grafana.app/listDeleted"

type Requirements struct {
	// Equals folder
	Folder *string
	// SortBy is a list of fields to sort by
	SortBy []string
	// ListDeleted is a flag to list deleted entities
	ListDeleted bool
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
		case listDeletedKey:
			if r.Operator() != selection.Equals {
				return requirements, newSelector, apierrors.NewBadRequest(listDeletedKey + " label selector only supports equality")
			}
			if len(r.Values().List()) != 1 {
				return requirements, newSelector, apierrors.NewBadRequest(listDeletedKey + " label selector only supports one value")
			}
			if r.Values().List()[0] != "true" && r.Values().List()[0] != "false" {
				return requirements, newSelector, apierrors.NewBadRequest(listDeletedKey + " label selector only supports true or false")
			}
			requirements.ListDeleted = r.Values().List()[0] == "true"
		// add all unregonized label selectors to the new selector list, these will be processed by the entity store
		default:
			newSelector = newSelector.Add(r)
		}
	}

	return requirements, newSelector, nil
}
