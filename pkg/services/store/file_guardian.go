package store

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	ActionFilesRead   = "files:read"
	ActionFilesWrite  = "files:write"
	ActionFilesDelete = "files:delete"
)

var (
	denyAllPathFilter  = filestorage.NewDenyAllPathFilter()
	allowAllPathFilter = filestorage.NewAllowAllPathFilter()
)

func isValidAction(action string) bool {
	return action == ActionFilesRead || action == ActionFilesWrite || action == ActionFilesDelete
}

type storageAuthService interface {
	newGuardian(ctx context.Context, user *user.SignedInUser, prefix string) fileGuardian
}

type fileGuardian interface {
	canView(path string) bool
	canWrite(path string) bool
	canDelete(path string) bool
	can(action string, path string) bool

	getPathFilter(action string) filestorage.PathFilter
}

type pathFilterFileGuardian struct {
	ctx                context.Context
	user               *user.SignedInUser
	prefix             string
	pathFilterByAction map[string]filestorage.PathFilter
	log                log.Logger
}

func (a *pathFilterFileGuardian) getPathFilter(action string) filestorage.PathFilter {
	if !isValidAction(action) {
		a.log.Warn("Unsupported action", "action", action)
		return denyAllPathFilter
	}

	if filter, ok := a.pathFilterByAction[action]; ok {
		return filter
	}

	return denyAllPathFilter
}

func (a *pathFilterFileGuardian) canWrite(path string) bool {
	return a.can(ActionFilesWrite, path)
}

func (a *pathFilterFileGuardian) canView(path string) bool {
	return a.can(ActionFilesRead, path)
}

func (a *pathFilterFileGuardian) canDelete(path string) bool {
	return a.can(ActionFilesDelete, path)
}

func (a *pathFilterFileGuardian) can(action string, path string) bool {
	if path == a.prefix {
		path = filestorage.Delimiter
	} else {
		path = strings.TrimPrefix(path, a.prefix)
	}
	allow := false

	if !isValidAction(action) {
		a.log.Warn("Unsupported action", "action", action, "path", path)
		return false
	}

	pathFilter, ok := a.pathFilterByAction[action]

	if !ok {
		a.log.Warn("Missing path filter", "action", action, "path", path)
		return false
	}

	allow = pathFilter.IsAllowed(path)
	if !allow {
		a.log.Warn("denying", "action", action, "path", path)
	}
	return allow
}

type denyAllFileGuardian struct {
}

func (d denyAllFileGuardian) canView(path string) bool {
	return d.can(ActionFilesRead, path)
}

func (d denyAllFileGuardian) canWrite(path string) bool {
	return d.can(ActionFilesWrite, path)
}

func (d denyAllFileGuardian) canDelete(path string) bool {
	return d.can(ActionFilesDelete, path)
}

func (d denyAllFileGuardian) can(action string, path string) bool {
	return false
}

func (d denyAllFileGuardian) getPathFilter(action string) filestorage.PathFilter {
	return denyAllPathFilter
}
