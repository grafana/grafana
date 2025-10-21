package checks

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestGetNamespaces(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		orgs        []string
		expected    []string
		expectedErr string
	}{
		{
			name:     "empty stack ID",
			input:    "",
			orgs:     []string{"default"},
			expected: []string{metav1.NamespaceDefault},
		},
		{
			name:     "valid stack ID",
			input:    "1234567890",
			orgs:     []string{"default"},
			expected: []string{"stacks-1234567890"},
		},
		{
			name:        "invalid stack ID",
			input:       "invalid",
			orgs:        []string{"default"},
			expected:    nil,
			expectedErr: "invalid stack id: invalid",
		},
		{
			name:     "multiple orgs",
			input:    "",
			orgs:     []string{"default", "org-2"},
			expected: []string{"default", "org-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeOrgService := &mockOrgService{
				SearchFunc: func(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
					orgs := make([]*org.OrgDTO, len(tt.orgs))
					for i, o := range tt.orgs {
						orgs[i] = &org.OrgDTO{ID: int64(i + 1), Name: o}
					}
					return orgs, nil
				},
			}
			result, err := GetNamespaces(context.Background(), tt.input, fakeOrgService)
			if tt.expectedErr != "" {
				assert.EqualError(t, err, tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.expected, result)
		})
	}
}

type mockOrgService struct {
	org.Service
	SearchFunc func(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

func (m *mockOrgService) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return m.SearchFunc(ctx, query)
}
