package user

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/selection"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

const (
	fieldLogin               = builders.USER_LOGIN
	fieldEmail               = builders.USER_EMAIL
	fieldLastSeenAt          = builders.USER_LAST_SEEN_AT
	fieldRole                = builders.USER_ROLE
	fieldDisabled            = builders.USER_DISABLED
	fieldExternalAuthModules = builders.USER_EXTERNAL_AUTH_MODULES
	legacyIDField            = resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID
)

var _ SearchBackend = (*unifiedSearchClient)(nil)

type unifiedSearchClient struct {
	client resourcepb.ResourceIndexClient
	cfg    *setting.Cfg
}

func NewUnifiedSearchClient(client resourcepb.ResourceIndexClient, cfg *setting.Cfg) SearchBackend {
	return &unifiedSearchClient{client: client, cfg: cfg}
}

func (c *unifiedSearchClient) Search(ctx context.Context, query SearchQuery) (*iamv0.GetSearchUsersResponse, error) {
	gr := iamv0.UserResourceInfo.GroupResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     gr.Group,
				Resource:  gr.Resource,
				Namespace: query.Namespace,
			},
		},
		Fields:       []string{resource.SEARCH_FIELD_TITLE, fieldEmail, fieldLogin, fieldLastSeenAt, fieldRole, fieldDisabled, fieldExternalAuthModules, resource.SEARCH_FIELD_CREATED, legacyIDField},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Limit:        query.Limit,
		Page:         query.Page,
		Offset:       query.Offset,
	}

	lookup := query.Email != nil || query.Login != nil
	if lookup {
		req.Fields = []string{resource.SEARCH_FIELD_NAME}
		if query.Email != nil {
			req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
				Key: fieldEmail, Operator: string(selection.Equals), Values: []string{*query.Email},
			})
		}
		if query.Login != nil {
			req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
				Key: fieldLogin, Operator: string(selection.Equals), Values: []string{*query.Login},
			})
		}
	} else {
		req.Query = fmt.Sprintf("*%s*", escapeBleveQuery(query.Query))
		req.QueryFields = []*resourcepb.ResourceSearchRequest_QueryField{
			{Name: resource.SEARCH_FIELD_TITLE},
			{Name: fieldEmail},
			{Name: fieldLogin},
		}
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		if !requester.GetIsGrafanaAdmin() {
			hiddenUsers := []string{}
			for login := range c.cfg.HiddenUsers {
				if login != requester.GetUsername() {
					hiddenUsers = append(hiddenUsers, login)
				}
			}
			if len(hiddenUsers) > 0 {
				req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
					Key: fieldLogin, Operator: string(selection.NotIn), Values: hiddenUsers,
				})
			}
		}
	}

	for _, field := range query.Sort {
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{
			Field: strings.TrimPrefix(field, "-"),
			Desc:  strings.HasPrefix(field, "-"),
		})
	}

	resp, err := c.client.Search(ctx, req)
	if err != nil {
		return nil, err
	}
	return parseResults(resp)
}
