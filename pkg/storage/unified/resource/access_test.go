package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	authlib "github.com/grafana/authlib/types"
)

func TestAuthzLimitedClient_Check(t *testing.T) {
	mockClient := authlib.FixedAccessClient(false)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	tests := []struct {
		group    string
		resource string
		expected bool
	}{
		{"dashboard.grafana.app", "dashboards", false},
		{"folder.grafana.app", "folders", false},
		{"unknown.group", "unknown.resource", true},
	}

	for _, test := range tests {
		req := authlib.CheckRequest{
			Group:    test.group,
			Resource: test.resource,
		}
		resp, err := client.Check(context.Background(), nil, req)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, resp.Allowed)
	}
}

func TestAuthzLimitedClient_Compile(t *testing.T) {
	mockClient := authlib.FixedAccessClient(false)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	tests := []struct {
		group    string
		resource string
		expected bool
	}{
		{"dashboard.grafana.app", "dashboards", false},
		{"folder.grafana.app", "folders", false},
		{"unknown.group", "unknown.resource", true},
	}

	for _, test := range tests {
		req := authlib.ListRequest{
			Group:    test.group,
			Resource: test.resource,
		}
		checker, err := client.Compile(context.Background(), nil, req)
		assert.NoError(t, err)
		assert.NotNil(t, checker)

		result := checker("namespace", "name", "folder")
		assert.Equal(t, test.expected, result)
	}
}
