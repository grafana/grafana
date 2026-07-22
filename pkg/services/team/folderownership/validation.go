package folderownership

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ErrTeamOwnsFolders prevents deletion until folder ownership is removed.
var ErrTeamOwnsFolders = errors.New("team owns one or more folders")

// ValidateNoOwnedFolders checks whether a team is referenced as a folder owner.
func ValidateNoOwnedFolders(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace, teamUID string) error {
	if searcher == nil {
		logging.FromContext(ctx).Warn("Skipping team folder-ownership check: no folder searcher configured", teamUID)
		return nil
	}

	folderGVR := foldersv1.FolderResourceInfo.GroupVersionResource()
	ownerReference := fmt.Sprintf("iam.grafana.app/Team/%s", teamUID)

	// This is a referential-integrity check, so it must include folders the requester cannot list.
	searchCtx := identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)
	resp, err := searcher.Search(searchCtx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     folderGVR.Group,
				Resource:  folderGVR.Resource,
			},
			Fields: []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_OWNER_REFERENCES,
				Operator: "=",
				Values:   []string{ownerReference},
			}},
		},
		Limit: 1,
	})
	if err != nil {
		return err
	}
	if resp == nil {
		return fmt.Errorf("search for folders owned by team %q returned no response", teamUID)
	}
	if resp.Error != nil {
		return resource.GetError(resp.Error)
	}

	if resp.TotalHits > 0 || (resp.Results != nil && len(resp.Results.Rows) > 0) {
		return fmt.Errorf("%w: team %q; remove folder ownership before deleting the team", ErrTeamOwnsFolders, teamUID)
	}

	return nil
}
