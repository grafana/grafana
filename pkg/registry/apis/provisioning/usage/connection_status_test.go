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
			Type:    provisioning.GithubOAuthConnectionType,
			Webhook: &provisioning.ConnectionWebhookConfig{Disabled: true},
		},
		Status: provisioning.ConnectionStatus{
			Health: provisioning.HealthStatus{Healthy: true},
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionTrue, Reason: provisioning.ReasonAvailable},
			},
		},
	}

	got := ConnectionUsageStatusFromConnection(conn)

	assert.Equal(t, ConnectionUsageStatus{
		Type:            string(provisioning.GithubOAuthConnectionType),
		CreatedAt:       1_500_000_000_000,
		UpdatedAt:       time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		Healthy:         true,
		ReadyReason:     provisioning.ReasonAvailable,
		WebhookDisabled: true,
	}, got)
}

func TestConnectionUsageStatusFromConnection_AuthFailure(t *testing.T) {
	conn := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
		Status: provisioning.ConnectionStatus{
			Health: provisioning.HealthStatus{Healthy: false},
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionFalse, Reason: provisioning.ReasonAuthenticationFailed},
			},
		},
	}

	got := ConnectionUsageStatusFromConnection(conn)

	assert.False(t, got.Healthy)
	assert.Equal(t, provisioning.ReasonAuthenticationFailed, got.ReadyReason)
	// The type doubles as the auth method: "github" is a GitHub App installation.
	assert.Equal(t, string(provisioning.GithubConnectionType), got.Type)
}

func TestConnectionUsageStatus_LogValues(t *testing.T) {
	s := ConnectionUsageStatus{
		Type:            string(provisioning.GitlabOAuthConnectionType),
		CreatedAt:       1_500_000_000_000,
		UpdatedAt:       1_550_000_000_000,
		Healthy:         false,
		ReadyReason:     provisioning.ReasonAuthenticationFailed,
		WebhookDisabled: false,
	}

	assert.Equal(t, []any{
		"connectionType", string(provisioning.GitlabOAuthConnectionType),
		"createdAt", int64(1_500_000_000_000),
		"updatedAt", int64(1_550_000_000_000),
		"healthy", 0,
		"readyReason", provisioning.ReasonAuthenticationFailed,
		"webhookDisabled", 0,
	}, s.LogValues())
}
