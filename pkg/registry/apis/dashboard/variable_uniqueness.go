package dashboard

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"

	authlib "github.com/grafana/authlib/types"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

const (
	// postCreateListMaxAttempts bounds the retry loop used to tolerate
	// apiserver watch-cache lag when verifying variable name uniqueness after
	// a successful create.
	postCreateListMaxAttempts = 3
	// postCreateListBackoff is the delay between retry attempts.
	postCreateListBackoff = 50 * time.Millisecond
)

func buildVariableNameListOptions(variableName, folderUID string) metav1.ListOptions {
	listOptions := metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("spec.spec.name", variableName).String(),
	}

	if folderUID != "" {
		listOptions.LabelSelector = labels.Set{variableFolderLabelKey: folderUID}.String()
	}

	return listOptions
}

func findVariableNameConflict(list *unstructured.UnstructuredList, folderUID, excludeMetadataName string) string {
	if list == nil {
		return ""
	}

	for _, item := range list.Items {
		if item.GetName() == excludeMetadataName {
			continue
		}

		itemFolderUID := item.GetLabels()[variableFolderLabelKey]
		if folderUID == "" {
			// Global scope ignores folder-scoped entries.
			if itemFolderUID != "" {
				continue
			}
		} else if itemFolderUID != folderUID {
			// Folder scope only considers entries in the same folder.
			continue
		}

		return item.GetName()
	}

	return ""
}

func (b *DashboardsAPIBuilder) validateVariableNameUniqueness(
	ctx context.Context,
	namespace string,
	variable *dashv2.Variable,
	excludeMetadataName string,
) error {
	if b.variableClientProvider == nil {
		// Standalone builder paths used in unit tests do not configure this provider.
		return nil
	}

	accessor, err := utils.MetaAccessor(variable)
	if err != nil {
		return fmt.Errorf("error getting variable meta accessor: %w", err)
	}

	variableName := getVariableName(variable.Spec)
	folderUID := accessor.GetFolder()
	listOptions := buildVariableNameListOptions(variableName, folderUID)
	nsInfo, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return fmt.Errorf("failed to parse namespace: %w", err)
	}

	variableClient := b.variableClientProvider.GetOrCreateHandler(namespace)
	list, err := variableClient.List(ctx, nsInfo.OrgID, listOptions)
	if err != nil {
		return fmt.Errorf("error listing variables for uniqueness check: %w", err)
	}

	if conflict := findVariableNameConflict(list, folderUID, excludeMetadataName); conflict != "" {
		if folderUID == "" {
			return fmt.Errorf("variable name %q already exists in global scope", variableName)
		}

		return fmt.Errorf("variable name %q already exists in folder %q", variableName, folderUID)
	}

	return nil
}

// resolveVariableNameConflictAfterCreate verifies variable name uniqueness
// after the object has already been persisted. It is a backstop for the
// admission-time check: if two concurrent Creates for the same
// (spec.spec.name, folder) both pass admission before either is committed,
// this function detects the resulting duplicate and applies a deterministic
// tie-break. Returns true when the created object is not the winner and
// therefore must be deleted by the caller.
//
// The list is re-issued with ResourceVersion = created.ResourceVersion and
// ResourceVersionMatch = NotOlderThan to guarantee the created object is
// visible to the reader. listVariablesWithRetry additionally loops briefly
// when the listing does not yet contain the created object, to tolerate
// watch-cache lag across apiserver replicas.
func resolveVariableNameConflictAfterCreate(
	ctx context.Context,
	provider client.K8sHandlerProvider,
	created *dashv2.Variable,
) (bool, error) {
	if provider == nil {
		return false, nil
	}

	createdAccessor, err := utils.MetaAccessor(created)
	if err != nil {
		return false, fmt.Errorf("error getting created variable meta accessor: %w", err)
	}

	specName := getVariableName(created.Spec)
	folderUID := createdAccessor.GetFolder()
	namespace := created.GetNamespace()
	nsInfo, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return false, fmt.Errorf("failed to parse namespace: %w", err)
	}

	listOptions := buildVariableNameListOptions(specName, folderUID)
	listOptions.ResourceVersion = created.GetResourceVersion()
	listOptions.ResourceVersionMatch = metav1.ResourceVersionMatchNotOlderThan

	variableClient := provider.GetOrCreateHandler(namespace)
	list, err := listVariablesWithRetry(ctx, variableClient, nsInfo.OrgID, listOptions, created.GetName())
	if err != nil {
		return false, err
	}

	siblings := filterVariablesInScope(list, folderUID)
	if len(siblings) <= 1 {
		return false, nil
	}

	winner := pickVariableWinner(siblings)
	return winner.GetUID() != created.GetUID(), nil
}

// listVariablesWithRetry performs up to postCreateListMaxAttempts list calls
// separated by postCreateListBackoff. It exits early once the just-created
// object is visible in the returned list, which indicates the reader is
// caught up enough to make an authoritative uniqueness decision.
func listVariablesWithRetry(
	ctx context.Context,
	variableClient client.K8sHandler,
	orgID int64,
	listOptions metav1.ListOptions,
	createdName string,
) (*unstructured.UnstructuredList, error) {
	var (
		list *unstructured.UnstructuredList
		err  error
	)
	for attempt := 0; attempt < postCreateListMaxAttempts; attempt++ {
		list, err = variableClient.List(ctx, orgID, listOptions)
		if err != nil {
			return nil, fmt.Errorf("error listing variables for post-create uniqueness check: %w", err)
		}
		if containsItemByName(list, createdName) {
			return list, nil
		}
		if attempt == postCreateListMaxAttempts-1 {
			break
		}
		select {
		case <-ctx.Done():
			return list, nil
		case <-time.After(postCreateListBackoff):
		}
	}
	return list, nil
}

func containsItemByName(list *unstructured.UnstructuredList, name string) bool {
	if list == nil {
		return false
	}
	for i := range list.Items {
		if list.Items[i].GetName() == name {
			return true
		}
	}
	return false
}

// filterVariablesInScope returns only the list items whose folder label
// matches the requested scope. Global scope (folderUID == "") keeps only
// items with no folder label; folder scope keeps only items whose folder
// label equals folderUID.
func filterVariablesInScope(list *unstructured.UnstructuredList, folderUID string) []unstructured.Unstructured {
	if list == nil {
		return nil
	}
	filtered := make([]unstructured.Unstructured, 0, len(list.Items))
	for _, item := range list.Items {
		itemFolderUID := item.GetLabels()[variableFolderLabelKey]
		if folderUID == "" {
			if itemFolderUID != "" {
				continue
			}
		} else if itemFolderUID != folderUID {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

// pickVariableWinner returns the tie-break winner among a set of variables
// that share the same (spec.spec.name, folder). Ordering is deterministic:
// earliest creationTimestamp first, with UID as a stable secondary key to
// break same-second ties. Both verifiers in a concurrent-create race reach
// the same result, so exactly one object survives.
func pickVariableWinner(items []unstructured.Unstructured) unstructured.Unstructured {
	winner := items[0]
	for _, candidate := range items[1:] {
		if lessVariable(candidate, winner) {
			winner = candidate
		}
	}
	return winner
}

func lessVariable(a, b unstructured.Unstructured) bool {
	aTime := a.GetCreationTimestamp()
	bTime := b.GetCreationTimestamp()
	if !aTime.Equal(&bTime) {
		return aTime.Before(&bTime)
	}
	return string(a.GetUID()) < string(b.GetUID())
}
