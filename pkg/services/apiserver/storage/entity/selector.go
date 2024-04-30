package entity

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
)

const FolderAnnoKey = "grafana.app/folder"
const SortByKey = "grafana.app/sortBy"
const ListDeletedKey = "grafana.app/listDeleted"
const ListHistoryKey = "grafana.app/listHistory"

type Requirements struct {
	// Equals folder
	Folder *string
	// SortBy is a list of fields to sort by
	SortBy []string
	// ListDeleted is a flag to list deleted entities
	ListDeleted bool
	// ListHistory is a resource name to list the history of
	ListHistory string
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
		case FolderAnnoKey:
			if (r.Operator() != selection.Equals) && (r.Operator() != selection.DoubleEquals) {
				return requirements, newSelector, apierrors.NewBadRequest(FolderAnnoKey + " label selector only supports equality")
			}
			folder := r.Values().List()[0]
			requirements.Folder = &folder
		case SortByKey:
			if r.Operator() != selection.In {
				return requirements, newSelector, apierrors.NewBadRequest(SortByKey + " label selector only supports in")
			}
			requirements.SortBy = r.Values().List()
		case ListDeletedKey:
			if r.Operator() != selection.Equals {
				return requirements, newSelector, apierrors.NewBadRequest(ListDeletedKey + " label selector only supports equality")
			}
			if len(r.Values().List()) != 1 {
				return requirements, newSelector, apierrors.NewBadRequest(ListDeletedKey + " label selector only supports one value")
			}
			if r.Values().List()[0] != "true" && r.Values().List()[0] != "false" {
				return requirements, newSelector, apierrors.NewBadRequest(ListDeletedKey + " label selector only supports true or false")
			}
			requirements.ListDeleted = r.Values().List()[0] == "true"
		case ListHistoryKey:
			if r.Operator() != selection.Equals {
				return requirements, newSelector, apierrors.NewBadRequest(ListHistoryKey + " label selector only supports equality")
			}
			if len(r.Values().List()) != 1 {
				return requirements, newSelector, apierrors.NewBadRequest(ListHistoryKey + " label selector only supports one value")
			}
			if r.Values().List()[0] == "" {
				return requirements, newSelector, apierrors.NewBadRequest(ListHistoryKey + " label selector must not be empty")
			}
			requirements.ListHistory = r.Values().List()[0]
		// add all unregonized label selectors to the new selector list, these will be processed by the entity store
		default:
			newSelector = newSelector.Add(r)
		}
	}

	if requirements.ListDeleted && requirements.ListHistory != "" {
		return requirements, newSelector, apierrors.NewBadRequest("cannot list deleted and history at the same time")
	}

	return requirements, newSelector, nil
}
