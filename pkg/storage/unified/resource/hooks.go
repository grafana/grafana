package resource

import (
	context "context"
	"fmt"

	"github.com/grafana/authlib/claims"
)

type WriteAccessHooks struct {
	// When configured, this will make sure a user is allowed to save to a given origin
	Origin func(ctx context.Context, user claims.AuthInfo, origin string) bool
}

type LifecycleHooks interface {
	// Called once at initialization
	Init(context.Context) error

	// Stop function -- after calling this, any additional storage functions may error
	Stop(context.Context) error
}

func (a *WriteAccessHooks) CanWriteOrigin(ctx context.Context, user claims.AuthInfo, uid string) error {
	if a.Origin == nil || uid == "UI" {
		return nil // default to OK
	}
	if !a.Origin(ctx, user, uid) {
		return fmt.Errorf("not allowed to write resource at origin")
	}
	return nil
}
