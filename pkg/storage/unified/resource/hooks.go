package resource

import (
	context "context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type WriteAccessHooks struct {
	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	Folder func(ctx context.Context, user identity.Requester, uid string) bool

	// When configured, this will make sure a user is allowed to save to a given origin
	Origin func(ctx context.Context, user identity.Requester, origin string) bool
}

type LifecycleHooks interface {
	// Called once at initialization
	Init(context.Context) error

	// Stop function -- after calling this, any additional storage functions may error
	Stop(context.Context) error
}

func (a *WriteAccessHooks) CanWriteFolder(ctx context.Context, user identity.Requester, uid string) error {
	if a.Folder == nil {
		return fmt.Errorf("writing folders is not supported")
	}
	if !a.Folder(ctx, user, uid) {
		return fmt.Errorf("not allowed to write resource to folder")
	}
	return nil
}

func (a *WriteAccessHooks) CanWriteOrigin(ctx context.Context, user identity.Requester, uid string) error {
	if a.Origin == nil || uid == "UI" {
		return nil // default to OK
	}
	if !a.Origin(ctx, user, uid) {
		return fmt.Errorf("not allowed to write resource at origin")
	}
	return nil
}
