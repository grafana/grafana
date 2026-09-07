package usage

import (
	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/api/meta"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ConnectionUsageStatus is a point-in-time snapshot of a single provisioning
// connection, logged by the connection controller on every reconcile. It mirrors
// RepositoryUsageStatus (read that type's doc for the rationale) for the shared
// git connections that repositories authenticate through.
//
// For a connection, Type *is* the authentication mechanism: "github" and
// "githubEnterprise" are GitHub App installations, while "githubOAuth",
// "githubEnterpriseOAuth", "gitlabOAuth", and "bitbucketOAuth" are OAuth apps.
// So "connections by type" doubles as "connections by auth method", and a
// token-backed repository's delegated auth resolves here.
//
// Connection identity (namespace, name) is carried by the reconcile logger, so it
// is not repeated in LogValues.
type ConnectionUsageStatus struct {
	// Type is the connection provider/auth type (github, githubOAuth, gitlabOAuth,
	// bitbucketOAuth, ...).
	Type string
	// CreatedAt is when the connection resource was created, in epoch milliseconds.
	CreatedAt int64
	// UpdatedAt is when the connection resource was last updated
	// (grafana.app/updatedTimestamp), in epoch milliseconds; 0 if never set.
	UpdatedAt int64
	// Healthy is the connection's last observed health.
	Healthy bool
	// ReadyReason classifies the connection's Ready condition: "Available" when
	// ready, or a failure class otherwise -- notably "AuthenticationFailed" and
	// "InvalidSpec". Empty before the first health check sets a Ready condition.
	ReadyReason string
	// WebhookDisabled reports that webhook integration is turned off for this
	// connection (Spec.Webhook.Disabled).
	WebhookDisabled bool
}

// LogConnectionUsageStatus emits the connection usage-status snapshot on logger.
// Connection identity is expected to already be on logger (the reconcile logger
// carries namespace and connection). Call it once per reconcile.
func LogConnectionUsageStatus(logger logging.Logger, conn *provisioning.Connection) {
	logger.Info("connection usage status", ConnectionUsageStatusFromConnection(conn).LogValues()...)
}

// ConnectionUsageStatusFromConnection builds a snapshot from the reconciled
// object. It performs no I/O — every field is read from the object in hand.
func ConnectionUsageStatusFromConnection(conn *provisioning.Connection) ConnectionUsageStatus {
	var readyReason string
	if ready := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady); ready != nil {
		readyReason = ready.Reason
	}

	var createdAt int64
	if ts := conn.GetCreationTimestamp(); !ts.IsZero() {
		createdAt = ts.UnixMilli()
	}
	var updatedAt int64
	if acc, err := utils.MetaAccessor(conn); err == nil {
		if ts, err := acc.GetUpdatedTimestamp(); err == nil && ts != nil {
			updatedAt = ts.UnixMilli()
		}
	}

	return ConnectionUsageStatus{
		Type:            string(conn.Spec.Type),
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
		Healthy:         conn.Status.Health.Healthy,
		ReadyReason:     readyReason,
		WebhookDisabled: conn.Spec.Webhook != nil && conn.Spec.Webhook.Disabled,
	}
}

// LogValues returns the snapshot as structured key/value pairs for the
// "connection usage status" line. Booleans render as 1/0 so they can be
// `unwrap`ped in Loki. These field names are part of the log's contract.
func (s ConnectionUsageStatus) LogValues() []any {
	return []any{
		"connectionType", s.Type,
		"createdAt", s.CreatedAt,
		"updatedAt", s.UpdatedAt,
		"healthy", boolToInt(s.Healthy),
		"readyReason", s.ReadyReason,
		"webhookDisabled", boolToInt(s.WebhookDisabled),
	}
}
