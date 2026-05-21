package display

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type SearchDisplayProvider struct {
	client resourcepb.ResourceIndexClient
}

func NewSearchDisplayProvider(client resourcepb.ResourceIndexClient) *SearchDisplayProvider {
	return &SearchDisplayProvider{client}
}

func (r *SearchDisplayProvider) GetDisplayList(ctx context.Context, ns authlib.NamespaceInfo, key []string) (*iam.DisplayList, error) {
	keys := parseKeys(key)

	// The search system does not yet support OR queries, so we will execute a query for each key
	req := &resourcepb.ResourceSearchRequest{
		Limit:  5,
		Fields: []string{"spec.title"},
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: ns.Value,
				Group:     iam.GROUP,
				Resource:  "users",
			},
		},
	}

	results := &iam.DisplayList{
		Keys:        keys.keys,
		InvalidKeys: keys.invalid,
		Items:       make([]iam.Display, 0, len(keys.uids)+len(keys.ids)+1),
	}

	for _, uid := range keys.uids {
		req.Options.Fields = []*resourcepb.Requirement{{
			Key:      "name",
			Operator: "=",
			Values:   []string{uid},
		}}

		rsp, err := r.client.Search(ctx, req)
		if err != nil {
			return nil, err
		}

		for _, item := range rsp.Results.Rows {
			item.Cells["name"] = uid
		}
	}

	for _, uid := range keys.ids {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
			Key:      "name",
			Operator: "=",
			Values:   []string{uid},
		})
	}

	users, err := r.store.ListDisplay(ctx, ns, legacy.ListDisplayQuery{
		OrgID: ns.OrgID,
		UIDs:  keys.uids,
		IDs:   keys.ids,
	})
	if err != nil {
		return nil, err
	}

	for _, user := range users.Items {
		disp := iam.Display{
			Identity: iam.IdentityRef{
				Type: authlib.TypeUser,
				Name: user.UID,
			},
			DisplayName: user.NameOrFallback(),
			InternalID:  user.ID, // nolint:staticcheck
		}
		if user.IsServiceAccount {
			disp.Identity.Type = authlib.TypeServiceAccount
		}
		disp.AvatarURL = dtos.GetGravatarUrlWithDefault(fakeCfgForGravatar, user.Email, disp.DisplayName)
		results.Items = append(results.Items, disp)
	}

	// Append the constants here
	if len(keys.disp) > 0 {
		results.Items = append(results.Items, keys.disp...)
	}
	return results, nil
}
