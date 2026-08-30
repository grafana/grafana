package v0alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-app-sdk/resource"
)

type GetTeamLBACRulesForSubjectRequest struct {
	SubjectType string
	SubjectUID  string
	Headers     http.Header
}

// GetTeamLBACRulesForSubjectResponse hides the generated Route suffix from callers.
// The CUE operation needs a distinct generated name because its generated client
// cannot interpolate path parameters and would otherwise collide with the
// hand-written GetTeamLBACRulesForSubject method below.
type GetTeamLBACRulesForSubjectResponse = GetTeamLBACRulesForSubjectRouteResponse

func NewGetTeamLBACRulesForSubjectResponse() *GetTeamLBACRulesForSubjectResponse {
	return &GetTeamLBACRulesForSubjectResponse{}
}

// GetTeamLBACRulesForSubject is hand-written because App SDK client generation
// currently preserves path placeholders instead of interpolating their values.
func (c *TeamLBACRuleClient) GetTeamLBACRulesForSubject(ctx context.Context, identifier resource.Identifier, request GetTeamLBACRulesForSubjectRequest) (*GetTeamLBACRulesForSubjectResponse, error) {
	path := "/for-subject/" + url.PathEscape(request.SubjectType) + "/" + url.PathEscape(request.SubjectUID)
	response, err := c.client.SubresourceRequest(ctx, identifier, resource.CustomRouteRequestOptions{
		Path:    path,
		Verb:    http.MethodGet,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}

	result := GetTeamLBACRulesForSubjectResponse{}
	if err := json.Unmarshal(response, &result); err != nil {
		return nil, fmt.Errorf("unmarshal TeamLBAC rules for subject response: %w", err)
	}
	return &result, nil
}
