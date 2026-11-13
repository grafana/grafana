package common

import (
	"context"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/util/dryrun"
)

// ValidateDeleteCollectionRequest rejects requests legacy storage cannot honor safely.
func ValidateDeleteCollectionRequest(options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) error {
	// Delete does not support dry-run either, but ignoring it there deletes one rule; here it would delete a whole set.
	if options != nil && dryrun.IsDryRun(options.DryRun) {
		return k8serrors.NewBadRequest("dry-run is not supported for collection deletion")
	}
	// The history and trash modes list past versions of rules, which carry the name of a live rule.
	// Deleting them by name would delete that rule.
	mode, _, err := ParseListMode(listOptions.LabelSelector, listOptions.FieldSelector)
	if err != nil {
		return k8serrors.NewBadRequest(err.Error())
	}
	if mode != ListModeNormal {
		return k8serrors.NewBadRequest("history and trash selectors are not supported for collection deletion")
	}
	return nil
}

// DeleteCollectionPageSize caps how many rules a DeleteCollection call lists and deletes at a time, so a large
// collection is never held in memory or deleted in one statement. It is a variable so tests can force paging.
var DeleteCollectionPageSize int64 = 500

// ListPage runs list once and returns the page's items and its continue token.
func ListPage(
	ctx context.Context,
	list func(context.Context, *internalversion.ListOptions) (runtime.Object, error),
	opts *internalversion.ListOptions,
) ([]runtime.Object, string, error) {
	obj, err := list(ctx, opts)
	if err != nil {
		return nil, "", err
	}
	items, err := meta.ExtractList(obj)
	if err != nil {
		return nil, "", err
	}
	accessor, err := meta.ListAccessor(obj)
	if err != nil {
		return nil, "", err
	}
	return items, accessor.GetContinue(), nil
}

// ObjectName returns the name of obj for use in error messages, or an empty string if it has none.
func ObjectName(obj runtime.Object) string {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return ""
	}
	return accessor.GetName()
}
