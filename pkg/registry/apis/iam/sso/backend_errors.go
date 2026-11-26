package sso

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/log"
)

var backendLogger = log.New("ssosettings.backend")

// backendError logs an unexpected storage failure and returns a generic internal
// error, so database and driver diagnostics never reach the API response. Errors
// that already carry an API status (not-found, forbidden, validation, ...) are
// returned unchanged: those messages are written for clients.
func backendError(ctx context.Context, err error) error {
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		return err
	}
	backendLogger.FromContext(ctx).Error("SSO settings backend operation failed", "error", err)
	return apierrors.NewInternalError(errors.New("SSO settings storage is unavailable"))
}
