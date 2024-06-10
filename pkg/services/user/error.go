package user

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrCaseInsensitive   = errors.New("case insensitive conflict")
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrLastGrafanaAdmin  = errors.New("cannot remove last grafana admin")
	ErrProtectedUser     = errors.New("cannot adopt protected user")
	ErrNoUniqueID        = errors.New("identifying id not found")
	ErrLastSeenUpToDate  = errors.New("last seen is already up to date")
	ErrUpdateInvalidID   = errors.New("unable to update invalid id")
)

var (
	ErrEmailConflict         = errutil.Conflict("user.email-conflict", errutil.WithPublicMessage("Email is already being used"))
	ErrEmptyUsernameAndEmail = errutil.BadRequest(
		"user.empty-username-and-email", errutil.WithPublicMessage("Need to specify either username or email"),
	)
)
