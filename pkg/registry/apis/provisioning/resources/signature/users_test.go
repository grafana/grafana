package signature

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// mockDynamicInterface implements a simplified version of the dynamic.ResourceInterface
type mockDynamicInterface struct {
	dynamic.ResourceInterface
	items []unstructured.Unstructured
	err   error
}

func (m *mockDynamicInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &unstructured.UnstructuredList{
		Items: m.items,
	}, nil
}

type mockGrafanaMetaAccessor struct {
	utils.GrafanaMetaAccessor
	createdBy           string
	updatedBy           string
	creationTimestamp   time.Time
	updatedTimestamp    *time.Time
	updatedTimestampErr error
}

func (m *mockGrafanaMetaAccessor) GetCreatedBy() string {
	return m.createdBy
}

func (m *mockGrafanaMetaAccessor) GetUpdatedBy() string {
	return m.updatedBy
}

func (m *mockGrafanaMetaAccessor) GetCreationTimestamp() metav1.Time {
	return metav1.Time{Time: m.creationTimestamp}
}

func (m *mockGrafanaMetaAccessor) GetUpdatedTimestamp() (*time.Time, error) {
	if m.updatedTimestampErr != nil {
		return nil, m.updatedTimestampErr
	}
	return m.updatedTimestamp, nil
}

func TestLoadUsersOnceSigner_Sign(t *testing.T) {
	baseTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	updateTime := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name          string
		items         []unstructured.Unstructured
		meta          *mockGrafanaMetaAccessor
		clientErr     error
		expectedSig   repository.CommitSignature
		expectedError string
	}{
		{
			name: "should sign with user info when user exists",
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
			},
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
				updatedTimestamp:  &updateTime,
			},
			expectedSig: repository.CommitSignature{
				Name:  "johndoe",
				Email: "john@example.com",
				When:  updateTime,
			},
		},
		{
			name: "should fallback to created by when updated by is empty",
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
			},
			meta: &mockGrafanaMetaAccessor{
				createdBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			expectedSig: repository.CommitSignature{
				Name:  "johndoe",
				Email: "john@example.com",
				When:  baseTime,
			},
		},
		{
			name: "should use grafana when no user info available",
			meta: &mockGrafanaMetaAccessor{
				creationTimestamp: baseTime,
			},
			expectedSig: repository.CommitSignature{
				Name: "grafana",
				When: baseTime,
			},
		},
		{
			name: "should handle user with same login and email",
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
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
				updatedTimestamp:  &updateTime,
			},
			expectedSig: repository.CommitSignature{
				Name:  "john@example.com",
				Email: "",
				When:  updateTime,
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
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
				updatedTimestamp:  &updateTime,
			},
			expectedSig: repository.CommitSignature{
				Name:  "user1",
				Email: "",
				When:  updateTime,
			},
		},
		{
			name: "should handle empty email",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							"login": "johndoe",
							"email": "",
						},
					},
				},
			},
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
				updatedTimestamp:  &updateTime,
			},
			expectedSig: repository.CommitSignature{
				Name:  "johndoe",
				Email: "",
				When:  updateTime,
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
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			expectedError: "load signatures: too many users",
		},
		{
			name: "should handle missing user fields gracefully",
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "user1",
						},
						"spec": map[string]interface{}{
							// missing login and email
						},
					},
				},
			},
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			expectedSig: repository.CommitSignature{
				Name: "user:user1",
				When: baseTime,
			},
		},
		{
			name: "should use creation timestamp when update timestamp has error",
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
			},
			meta: &mockGrafanaMetaAccessor{
				updatedBy:           "user:user1",
				creationTimestamp:   baseTime,
				updatedTimestampErr: errors.New("update timestamp error"),
			},
			expectedSig: repository.CommitSignature{
				Name:  "johndoe",
				Email: "john@example.com",
				When:  baseTime,
			},
		},
		{
			name: "should fail when listing users fails",
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			clientErr:     fmt.Errorf("failed to list users"),
			expectedError: "load signatures: error executing list: failed to list users",
		},
		{
			name: "should handle empty user list",
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			items: []unstructured.Unstructured{},
			expectedSig: repository.CommitSignature{
				Name: "user:user1",
				When: baseTime,
			},
		},
		{
			name: "should handle multiple calls with error",
			meta: &mockGrafanaMetaAccessor{
				updatedBy:         "user:user1",
				creationTimestamp: baseTime,
			},
			clientErr:     fmt.Errorf("failed to list users"),
			expectedError: "load signatures: error executing list: failed to list users",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &mockDynamicInterface{
				items: tt.items,
				err:   tt.clientErr,
			}

			signer := NewLoadUsersOnceSigner(client)
			ctx := context.Background()

			signedCtx, err := signer.Sign(ctx, tt.meta)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)

				// Test that subsequent calls also fail with the same error
				_, err2 := signer.Sign(ctx, tt.meta)
				require.Error(t, err2)
				require.Contains(t, err2.Error(), tt.expectedError)
				return
			}

			require.NoError(t, err)
			sig := repository.GetAuthorSignature(signedCtx)
			require.NotNil(t, sig)
			require.Equal(t, tt.expectedSig.Name, sig.Name)
			require.Equal(t, tt.expectedSig.Email, sig.Email)
			require.Equal(t, tt.expectedSig.When, sig.When)

			// Test that subsequent calls use cached data
			signedCtx2, err := signer.Sign(ctx, tt.meta)
			require.NoError(t, err)
			sig2 := repository.GetAuthorSignature(signedCtx2)
			require.Equal(t, sig, sig2)
		})
	}
}
