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

// permissionsSubjectRes extract the rejected subject from a permissions
// violation. nats.go reports these through processTransientError, which always
// passes a nil *Subscription — for subscribe rejections as much as publish ones
// — so the subject is only available from the error text.
var permissionsSubjectRes = []*regexp.Regexp{
	regexp.MustCompile(`Publish to "(\S+)"`),
	regexp.MustCompile(`Subscription to "(\S+)"`),
}

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
	msg := err.Error()
	for _, re := range permissionsSubjectRes {
		if match := re.FindStringSubmatch(msg); len(match) == 2 {
			return match[1]
		}
	}
	return ""
}

func asyncErrorLabels(sub *natsclient.Subscription, err error) (group, resource, reason string) {
	group, _, resource, _ = resourcewatch.ParseSubject(asyncErrorSubject(sub, err))
	return group, resource, asyncErrorReason(err)
}
