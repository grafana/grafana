package resource

import (
	context "context"
)

type LifecycleHooks interface {
	// Called once at initialization
	Init(context.Context) error

	// Stop function -- after calling this, any additional storage functions may error
	Stop(context.Context) error
}
