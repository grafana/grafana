package resource

import (
	context "context"
	"fmt"

	claims "github.com/grafana/authlib/types"
)

type WriteAccessHooks struct {
	// When configured, this will make sure a user is allowed to save to a given origin
	CanWriteValueFromRepoCheck func(ctx context.Context, user claims.AuthInfo, origin string) bool
}

type LifecycleHooks interface {
	// Called once at initialization
	Init(context.Context) error

	// Stop function -- after calling this, any additional storage functions may error
	Stop(context.Context) error
}

func (a *WriteAccessHooks) CanWriteValueFromRepository(ctx context.Context, user claims.AuthInfo, uid string) error {
	if a.CanWriteValueFromRepoCheck == nil || uid == "UI" {
		return nil // default to OK
	}
	if !a.CanWriteValueFromRepoCheck(ctx, user, uid) {
		return fmt.Errorf("not allowed to write resource at origin")
	}
	return nil
}
