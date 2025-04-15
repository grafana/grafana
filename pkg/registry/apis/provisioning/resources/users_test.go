package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// mockDynamicInterface implements a simplified version of the dynamic.ResourceInterface
type mockDynamicInterface struct {
	dynamic.ResourceInterface
	items []unstructured.Unstructured
}

func (m *mockDynamicInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return &unstructured.UnstructuredList{
		Items: m.items,
	}, nil
}

func TestLoadUsers(t *testing.T) {
	tests := []struct {
		name          string
		items         []unstructured.Unstructured
		expectedUsers map[string]repository.CommitSignature
		expectedError string
	}{
		{
			name: "should load users successfully",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							"login": "johndoe",
							"email": "john@example.com",
						},
					},
				},
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user2",
						},
						"spec": map[string]interface{}{
							"login": "janedoe",
							"email": "jane@example.com",
						},
					},
				},
			},
			expectedUsers: map[string]repository.CommitSignature{
				"user:user1": {
					Name:  "johndoe",
					Email: "john@example.com",
				},
				"user:user2": {
					Name:  "janedoe",
					Email: "jane@example.com",
				},
			},
		},
		{
			name: "should handle missing email",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							"login": "johndoe",
							// email missing
						},
					},
				},
			},
			expectedUsers: map[string]repository.CommitSignature{},
		},
		{
			name: "should handle missing login",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							// login missing
							"email": "john@example.com",
						},
					},
				},
			},
			expectedUsers: map[string]repository.CommitSignature{},
		},
		{
			name: "should handle same login and email",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							"login": "john@example.com",
							"email": "john@example.com",
						},
					},
				},
			},
			expectedUsers: map[string]repository.CommitSignature{
				"user:user1": {
					Name:  "john@example.com",
					Email: "", // Email should be empty when same as login
				},
			},
		},
		{
			name: "should handle empty login and email",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							"login": "",
							"email": "",
						},
					},
				},
			},
			expectedUsers: map[string]repository.CommitSignature{
				"user:user1": {
					Name:  "user1", // Should use metadata name when login is empty
					Email: "",
				},
			},
		},
		{
			name: "should fail when too many users",
			items: func() []unstructured.Unstructured {
				items := make([]unstructured.Unstructured, maxUsers+1)
				for i := 0; i < maxUsers+1; i++ {
					items[i] = unstructured.Unstructured{
						Object: map[string]interface{}{
							"metadata": map[string]interface{}{
								"name": "user1",
							},
							"spec": map[string]interface{}{
								"login": "johndoe",
								"email": "john@example.com",
							},
						},
					}
				}
				return items
			}(),
			expectedError: "too many users",
		},
		{
			name:          "should handle empty user list",
			items:         []unstructured.Unstructured{},
			expectedUsers: map[string]repository.CommitSignature{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &mockDynamicInterface{
				items: tt.items,
			}

			userInfo, err := loadUsers(context.Background(), client)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expectedUsers, userInfo)
		})
	}
}
