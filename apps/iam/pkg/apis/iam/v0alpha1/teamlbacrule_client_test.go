package v0alpha1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/resource"
)

func TestTeamLBACRuleClientGetTeamLBACRulesForSubject(t *testing.T) {
	transport := &recordingResourceClient{responses: [][]byte{
		[]byte(`{"team_filters":{"team-a":["foo=\"bar\""]}}`),
	}}
	client := NewTeamLBACRuleClient(transport)

	response, err := client.GetTeamLBACRulesForSubject(
		context.Background(),
		resource.Identifier{Namespace: "org-1", Name: "prometheus.datasource-a"},
		GetTeamLBACRulesForSubjectRequest{
			SubjectType: "user",
			SubjectUID:  "user-a",
		},
	)
	require.NoError(t, err)
	require.Equal(t, map[string][]string{"team-a": {`foo="bar"`}}, response.TeamFilters)
	require.Len(t, transport.requests, 1)
	require.Equal(t, "/for-subject/user/user-a", transport.requests[0].Path)
	require.Equal(t, "GET", transport.requests[0].Verb)
	require.Empty(t, transport.requests[0].Query)
}
