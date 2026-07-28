package dashboard

import (
	"context"
	"strings"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
)

const (
	ScopeVariablesRoot   = "variables"
	ScopeVariablesPrefix = "variables:uid:"

	ActionVariablesCreate = ac.ActionVariablesCreate
	ActionVariablesRead   = ac.ActionVariablesRead
	ActionVariablesWrite  = ac.ActionVariablesWrite
	ActionVariablesDelete = ac.ActionVariablesDelete
)

var (
	ScopeVariablesProvider = ac.NewScopeProvider(ScopeVariablesRoot)
	ScopeVariablesAll      = ScopeVariablesProvider.GetResourceAllScope()
)

// folderUIDFromVariableMetadataName derives the parent folder UID from a Variable
// metadata.name. Folder-scoped names are "<specName>--<folderUID>"; org-wide
// (root) names have no folder suffix and map to the general folder.
func folderUIDFromVariableMetadataName(metadataName string) string {
	if idx := strings.LastIndex(metadataName, "--"); idx >= 0 && idx+2 < len(metadataName) {
		return metadataName[idx+2:]
	}
	return ac.GeneralFolderUID
}

// VariableUIDScopeResolver converts a scope prefixed with "variables:uid:" into
// the variable UID scope plus its parent folder (and ancestors).
func VariableUIDScopeResolver(folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeVariablesProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		folderUID := folderUIDFromVariableMetadataName(uid)
		inheritedScopes, err := folder.GetInheritedScopes(ctx, orgID, folderUID, folderSvc)
		if err != nil {
			return nil, err
		}

		return append(inheritedScopes, folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID), ScopeVariablesProvider.GetResourceScopeUID(uid)), nil
	})
}
