package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

func (c *UserClient) GetUserTeamsAll(ctx context.Context, identifier resource.Identifier, request GetUserTeamsRequest) (*GetUserTeamsResponse, error) {
	request.Params.Continue = ""
	response, err := c.GetUserTeams(ctx, identifier, request)
	if err != nil {
		return nil, err
	}

	for response.Continue != "" {
		request.Params.Continue = response.Continue
		page, err := c.GetUserTeams(ctx, identifier, request)
		if err != nil {
			return nil, err
		}
		response.Items = append(response.Items, page.Items...)
		response.Continue = page.Continue
		response.ResourceVersion = page.ResourceVersion
	}

	return response, nil
}
