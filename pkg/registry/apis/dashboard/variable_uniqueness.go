package dashboard

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"

	authlib "github.com/grafana/authlib/types"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
