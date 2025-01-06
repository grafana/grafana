package resource

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authz"
	"github.com/stretchr/testify/assert"
)

func TestAuthzLimitedClient_Check(t *testing.T) {
	mockClient := &staticAuthzClient{allowed: false}
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
		req := authz.CheckRequest{
			Group:    test.group,
			Resource: test.resource,
		}
		resp, err := client.Check(context.Background(), nil, req)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, resp.Allowed)
	}
}

func TestAuthzLimitedClient_Compile(t *testing.T) {
	mockClient := &staticAuthzClient{allowed: false}
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
		req := authz.ListRequest{
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
