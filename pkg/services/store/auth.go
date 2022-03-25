package store

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	storeAuthMainLogger = log.New("storeAuthMainLogger")
	denyAllPathFilter   = filestorage.NewDenyAllPathFilter()
	allowAllPathFilter  = filestorage.NewAllowAllPathFilter()
)

type storageAuthService interface {
	newGuardian(ctx context.Context, user *models.SignedInUser, prefix string) fileGuardian
}

type fileGuardian interface {
	canView(path string) bool
	canSave(path string) bool
	can(action string, path string) bool

	getViewPathFilter() filestorage.PathFilter
	getSavePathFilter() filestorage.PathFilter
}

type pathFilterFileGuardian struct {
	ctx                context.Context
	user               *models.SignedInUser
	storageName        string
	pathFilterByAction map[string]filestorage.PathFilter
	log                log.Logger
}

func (a *pathFilterFileGuardian) getSavePathFilter() filestorage.PathFilter {
	if filter, ok := a.pathFilterByAction[ac.ActionFilesWrite]; ok {
		return filter
	}

	return denyAllPathFilter
}

func (a *pathFilterFileGuardian) getViewPathFilter() filestorage.PathFilter {
	if filter, ok := a.pathFilterByAction[ac.ActionFilesRead]; ok {
		return filter
	}

	return denyAllPathFilter
}

func (a *pathFilterFileGuardian) canSave(path string) bool {
	return a.can(ac.ActionFilesWrite, path)
}

func (a *pathFilterFileGuardian) canView(path string) bool {
	return a.can(ac.ActionFilesRead, path)
}

func (a *pathFilterFileGuardian) can(action string, path string) bool {
	path = strings.TrimPrefix(path, a.storageName)
	allow := false

	switch action {
	case ac.ActionFilesCreate:
		fallthrough
	case ac.ActionFilesWrite:
		fallthrough
	case ac.ActionFilesDelete:
		allow = a.pathFilterByAction[ac.ActionFilesWrite].IsAllowed(path)
	case ac.ActionFilesRead:
		allow = a.pathFilterByAction[ac.ActionFilesRead].IsAllowed(path)
	default:
		storeAuthMainLogger.Warn("Unsupported action", "action", action, "path", path)
		allow = false
	}

	if !allow {
		a.log.Warn("denying", "action", action, "path", path)
	}
	return allow
}

func allowFileScope(path string) string {
	return ac.Scope("files", "path", path)
}

func denyFileScope(path string) string {
	return ac.Scope("files", "path", "!"+path)
}

func isDenyFileScope(scope string) bool {
	return strings.HasPrefix(scope, "files:path:!")
}

func addPrefixToFileScope(scope string, prefix string) string {
	path := parsePath(scope)
	if isDenyFileScope(scope) {
		return denyFileScope(filestorage.Join(prefix, strings.TrimPrefix(path, "!")))
	}

	return allowFileScope(filestorage.Join(prefix, path))
}

func fileScope(path string) string {
	return ac.Scope("files", "path", path)
}

type denyAllFileGuardian struct {
}

func (d denyAllFileGuardian) canView(path string) bool {
	return false
}

func (d denyAllFileGuardian) canSave(path string) bool {
	return false
}

func (d denyAllFileGuardian) can(action string, path string) bool {
	return false
}

func (d denyAllFileGuardian) getViewPathFilter() filestorage.PathFilter {
	return denyAllPathFilter
}

func (d denyAllFileGuardian) getSavePathFilter() filestorage.PathFilter {
	return denyAllPathFilter
}
