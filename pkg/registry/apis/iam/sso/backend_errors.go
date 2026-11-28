package sso

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/log"
)

var backendLogger = log.New("ssosettings.backend")

// backendError logs an unexpected operation failure and returns a generic
// internal error, so backend diagnostics never reach the API response. Errors
// that already carry an API status (not-found, forbidden, validation, ...) are
// returned unchanged: those messages are written for clients. Only the outer
// error is inspected, matching the apiserver's own classification; a status
// wrapped in a plain error would otherwise render as a 500 carrying the full
// message.
func backendError(ctx context.Context, err error) error {
	if _, ok := err.(apierrors.APIStatus); ok { //nolint:errorlint // must match responsewriters.ErrorToAPIStatus
		return err
	}
	backendLogger.FromContext(ctx).Error("SSO settings backend operation failed", "error", err)
	return apierrors.NewInternalError(errors.New("SSO settings operation failed"))
}
