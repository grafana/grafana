package v0alpha1

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/resource"
)

type recordingResourceClient struct {
	resource.Client
	requests  []resource.CustomRouteRequestOptions
	responses [][]byte
	errors    []error
	onRequest func(context.Context, int)
}

func (c *recordingResourceClient) SubresourceRequest(ctx context.Context, _ resource.Identifier, request resource.CustomRouteRequestOptions) ([]byte, error) {
	c.requests = append(c.requests, request)
	if c.onRequest != nil {
		c.onRequest(ctx, len(c.requests))
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(c.errors) > 0 {
		err := c.errors[0]
		c.errors = c.errors[1:]
		if err != nil {
			return nil, err
		}
	}
	if len(c.responses) > 0 {
		response := c.responses[0]
		c.responses = c.responses[1:]
		return response, nil
	}
	return []byte(`{}`), nil
}

func TestUserClientGetUserTeamsEncodesPaginationParameters(t *testing.T) {
	transport := &recordingResourceClient{}
	client := NewUserClient(transport)

	_, err := client.GetUserTeams(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{
		Params: GetUserTeamsRequestParams{
			Limit:    25,
			Continue: "next+/=",
		},
	})
	require.NoError(t, err)
	require.Equal(t, "continue=next%2B%2F%3D&limit=25", transport.requests[0].Query.Encode())
}

func TestUserClientGetUserTeamsAllReturnsOnePage(t *testing.T) {
	transport := &recordingResourceClient{responses: [][]byte{
		[]byte(`{"items":[{"user":"user-1","team":"team-1","permission":"Member","external":false}]}`),
	}}
	client := NewUserClient(transport)

	response, err := client.GetUserTeamsAll(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{})
	require.NoError(t, err)
	require.Len(t, response.Items, 1)
	require.Equal(t, "team-1", response.Items[0].Team)
}

func TestUserClientGetUserTeamsAllCombinesMultiplePages(t *testing.T) {
	transport := &recordingResourceClient{responses: [][]byte{
		[]byte(`{"metadata":{"continue":"next+/="},"items":[{"user":"user-1","team":"team-1"}]}`),
		[]byte(`{"metadata":{"resourceVersion":"2"},"items":[{"user":"user-1","team":"team-2"}]}`),
	}}
	client := NewUserClient(transport)

	response, err := client.GetUserTeamsAll(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{
		Params: GetUserTeamsRequestParams{Limit: 1},
	})
	require.NoError(t, err)
	require.Equal(t, []GetUserTeamsUserTeam{{User: "user-1", Team: "team-1"}, {User: "user-1", Team: "team-2"}}, response.Items)
	require.Empty(t, response.Continue)
	require.Equal(t, "2", response.ResourceVersion)
	require.Equal(t, "continue=&limit=1", transport.requests[0].Query.Encode())
	require.Equal(t, "continue=next%2B%2F%3D&limit=1", transport.requests[1].Query.Encode())
}

func TestUserClientGetUserTeamsAllStartsFromFirstPage(t *testing.T) {
	transport := &recordingResourceClient{responses: [][]byte{[]byte(`{"items":[]}`)}}
	client := NewUserClient(transport)

	_, err := client.GetUserTeamsAll(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{
		Params: GetUserTeamsRequestParams{Limit: 25, Continue: "caller-token"},
	})
	require.NoError(t, err)
	require.Equal(t, "continue=&limit=25", transport.requests[0].Query.Encode())
}

func TestUserClientGetUserTeamsAllReturnsEmptyResult(t *testing.T) {
	transport := &recordingResourceClient{responses: [][]byte{[]byte(`{"items":[]}`)}}
	client := NewUserClient(transport)

	response, err := client.GetUserTeamsAll(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{})
	require.NoError(t, err)
	require.Empty(t, response.Items)
}

func TestUserClientGetUserTeamsAllReturnsLaterPageError(t *testing.T) {
	wantErr := errors.New("second page failed")
	transport := &recordingResourceClient{
		responses: [][]byte{[]byte(`{"metadata":{"continue":"next"},"items":[{"user":"user-1","team":"team-1"}]}`)},
		errors:    []error{nil, wantErr},
	}
	client := NewUserClient(transport)

	response, err := client.GetUserTeamsAll(context.Background(), resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{})
	require.ErrorIs(t, err, wantErr)
	require.Nil(t, response)
}

func TestUserClientGetUserTeamsAllReturnsLaterPageCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	transport := &recordingResourceClient{
		responses: [][]byte{[]byte(`{"metadata":{"continue":"next"},"items":[{"user":"user-1","team":"team-1"}]}`)},
		onRequest: func(_ context.Context, call int) {
			if call == 2 {
				cancel()
			}
		},
	}
	client := NewUserClient(transport)

	response, err := client.GetUserTeamsAll(ctx, resource.Identifier{Namespace: "org-1", Name: "user-1"}, GetUserTeamsRequest{})
	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, response)
}
