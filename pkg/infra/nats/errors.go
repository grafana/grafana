package nats

import (
	"errors"
	"regexp"

	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

const (
	reasonPermissionsViolation = "permissions_violation"
	reasonAuthorization        = "authorization"
	reasonAuthExpired          = "auth_expired"
	reasonAuthRevoked          = "auth_revoked"
	reasonAccountAuthExpired   = "account_auth_expired"
	reasonMaxSubscriptions     = "max_subscriptions"
	reasonSlowConsumer         = "slow_consumer"
	reasonOther                = "other"
)

var connStateErrs = []error{
	natsclient.ErrReconnectBufExceeded,
	natsclient.ErrConnectionClosed,
	natsclient.ErrConnectionDraining,
}

// publishPermissionsRe extracts the subject from a publish permissions
// violation. The server names the rejected subject in the error text only —
// nats.go passes a nil *Subscription for a publish rejection, since no
// subscription is involved — so the subject has to be read back out of the
// message. Mirrors nats.go's own permissionsRe for the subscribe direction.
var publishPermissionsRe = regexp.MustCompile(`Publish to "(\S+)"`)

func isConnStateErr(err error) bool {
	for _, target := range connStateErrs {
		if errors.Is(err, target) {
			return true
		}
	}
	return false
}

func asyncErrorReason(err error) string {
	switch {
	case errors.Is(err, natsclient.ErrPermissionViolation):
		return reasonPermissionsViolation
	case errors.Is(err, natsclient.ErrAuthorization):
		return reasonAuthorization
	case errors.Is(err, natsclient.ErrAuthExpired):
		return reasonAuthExpired
	case errors.Is(err, natsclient.ErrAuthRevoked):
		return reasonAuthRevoked
	case errors.Is(err, natsclient.ErrAccountAuthExpired):
		return reasonAccountAuthExpired
	case errors.Is(err, natsclient.ErrMaxSubscriptionsExceeded):
		return reasonMaxSubscriptions
	case errors.Is(err, natsclient.ErrSlowConsumer):
		return reasonSlowConsumer
	default:
		return reasonOther
	}
}

func asyncErrorSubject(sub *natsclient.Subscription, err error) string {
	if sub != nil {
		return sub.Subject
	}
	if match := publishPermissionsRe.FindStringSubmatch(err.Error()); len(match) == 2 {
		return match[1]
	}
	return ""
}

func asyncErrorLabels(sub *natsclient.Subscription, err error) (group, resource, reason string) {
	group, _, resource, _ = resourcewatch.ParseSubject(asyncErrorSubject(sub, err))
	return group, resource, asyncErrorReason(err)
}
