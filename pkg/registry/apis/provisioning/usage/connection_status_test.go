package usage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestConnectionUsageStatusFromConnection(t *testing.T) {
	created := metav1.NewTime(time.UnixMilli(1_500_000_000_000).UTC())
	conn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{
			CreationTimestamp: created,
			Annotations:       map[string]string{utils.AnnoKeyUpdatedTimestamp: "2021-01-01T00:00:00Z"},
		},
		Spec: provisioning.ConnectionSpec{
			Type:    provisioning.ConnectionTypeGithubOAuth,
			Webhook: &provisioning.ConnectionWebhookConfig{Disabled: true},
		},
		Status: provisioning.ConnectionStatus{
			Health: provisioning.ConnectionHealthStatus{Healthy: true},
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionTrue, Reason: provisioning.ReasonAvailable},
			},
		},
	}

	got := ConnectionUsageStatusFromConnection(conn)

	assert.Equal(t, ConnectionUsageStatus{
		Type:            string(provisioning.ConnectionTypeGithubOAuth),
		CreatedAt:       1_500_000_000_000,
		UpdatedAt:       time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		Healthy:         true,
		ReadyReason:     provisioning.ReasonAvailable,
		WebhookDisabled: true,
	}, got)
}

func TestConnectionUsageStatusFromConnection_AuthFailure(t *testing.T) {
	conn := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{Type: provisioning.ConnectionTypeGithub},
		Status: provisioning.ConnectionStatus{
			Health: provisioning.ConnectionHealthStatus{Healthy: false},
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionFalse, Reason: provisioning.ReasonAuthenticationFailed},
			},
		},
	}

	got := ConnectionUsageStatusFromConnection(conn)

	assert.False(t, got.Healthy)
	assert.Equal(t, provisioning.ReasonAuthenticationFailed, got.ReadyReason)
	// The type doubles as the auth method: "github" is a GitHub App installation.
	assert.Equal(t, string(provisioning.ConnectionTypeGithub), got.Type)
}

func TestConnectionUsageStatus_LogValues(t *testing.T) {
	s := ConnectionUsageStatus{
		Type:               string(provisioning.ConnectionTypeGitlabOAuth),
		CreatedAt:          1_500_000_000_000,
		UpdatedAt:          1_550_000_000_000,
		Healthy:            false,
		ReadyReason:        provisioning.ReasonAuthenticationFailed,
		WebhookDisabled:    false,
		TokenLastUpdatedAt: 1_600_000_000_000,
		TokenExpiresAt:     1_600_003_600_000,
	}

	assert.Equal(t, []any{
		"connectionType", string(provisioning.ConnectionTypeGitlabOAuth),
		"createdAt", int64(1_500_000_000_000),
		"updatedAt", int64(1_550_000_000_000),
		"healthy", 0,
		"readyReason", provisioning.ReasonAuthenticationFailed,
		"webhookDisabled", 0,
		"tokenLastUpdatedAt", int64(1_600_000_000_000),
		"tokenExpiresAt", int64(1_600_003_600_000),
	}, s.LogValues())
}
