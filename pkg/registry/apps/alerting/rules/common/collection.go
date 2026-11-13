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

// ListForDeleteCollection collects the objects a DeleteCollection call acts on by running list with the caller's
// selectors, so it matches exactly what a GET on the collection would return. Like the upstream apiserver, it follows
// continue tokens until the list is exhausted, unless the caller set a limit, in which case only that single page is
// returned. It returns the items and the continue token of the last page listed (always empty when no limit is set).
func ListForDeleteCollection(
	ctx context.Context,
	list func(context.Context, *internalversion.ListOptions) (runtime.Object, error),
	opts *internalversion.ListOptions,
) ([]runtime.Object, string, error) {
	opts = opts.DeepCopy()
	hasLimit := opts.Limit > 0

	var items []runtime.Object
	for {
		if err := ctx.Err(); err != nil {
			return nil, "", err
		}
		obj, err := list(ctx, opts)
		if err != nil {
			return nil, "", err
		}
		page, err := meta.ExtractList(obj)
		if err != nil {
			return nil, "", err
		}
		items = append(items, page...)

		accessor, err := meta.ListAccessor(obj)
		if err != nil {
			return nil, "", err
		}
		next := accessor.GetContinue()
		if hasLimit {
			return items, next, nil
		}
		if next == "" {
			return items, "", nil
		}
		opts.Continue = next
		opts.ResourceVersion = ""
		opts.ResourceVersionMatch = ""
	}
}

// ObjectName returns the name of obj for use in error messages, or an empty string if it has none.
func ObjectName(obj runtime.Object) string {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return ""
	}
	return accessor.GetName()
}
