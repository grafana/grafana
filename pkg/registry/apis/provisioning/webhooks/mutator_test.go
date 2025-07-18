package webhooks

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMutator(t *testing.T) {
	tests := []struct {
		name                    string
		obj                     runtime.Object
		secret                  string
		setupMocks              func(*secrets.MockRepositorySecrets)
		expectedEncryptedSecret string
		expectedError           string
	}{
		{
			name: "successful secret encryption",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						Secret: "webhook-secret",
					},
				},
			},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Encrypt(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
						Status: provisioning.RepositoryStatus{
							Webhook: &provisioning.WebhookStatus{
								Secret: "webhook-secret",
							},
						},
					},
					"test-repo-webhook-secret",
					"webhook-secret",
				).Return([]byte("encrypted-webhook-secret"), nil)
			},
			expectedEncryptedSecret: "encrypted-webhook-secret",
		},
		{
			name: "encryption error",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						Secret: "webhook-secret",
					},
				},
			},
			setupMocks: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Encrypt(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
						Status: provisioning.RepositoryStatus{
							Webhook: &provisioning.WebhookStatus{
								Secret: "webhook-secret",
							},
						},
					},
					"test-repo-webhook-secret",
					"webhook-secret",
				).Return(nil, errors.New("encryption failed"))
			},
			expectedError: "encryption failed",
		},
		{
			name: "no webhook status",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Status: provisioning.RepositoryStatus{
					Webhook: nil,
				},
			},
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
		{
			name: "empty secret",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						Secret: "",
					},
				},
			},
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
			setupMocks: func(_ *secrets.MockRepositorySecrets) {
				// No expectations
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecrets := secrets.NewMockRepositorySecrets(t)
			tt.setupMocks(mockSecrets)

			mutator := Mutator(mockSecrets)
			err := mutator(context.Background(), tt.obj)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)

				// Check that secret was cleared and encrypted secret was set
				if repo, ok := tt.obj.(*provisioning.Repository); ok && repo.Status.Webhook != nil {
					if tt.expectedEncryptedSecret != "" {
						// Secret should be cleared after encryption
						assert.Empty(t, repo.Status.Webhook.Secret, "Secret should be cleared after encryption")
						// EncryptedSecret should be set to the expected value
						assert.Equal(t, tt.expectedEncryptedSecret, string(repo.Status.Webhook.EncryptedSecret), "EncryptedSecret should match expected value")
					}
				}
			}
		})
	}
}
