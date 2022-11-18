package login

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/loginattempt"
)

var (
	maxInvalidLoginAttempts int64 = 5
)

var validateLoginAttempts = func(ctx context.Context, query *models.LoginUserQuery, loginAttemptService loginattempt.Service) error {
	ok, err := loginAttemptService.ValidateAttempts(ctx, query.Username)
	if err != nil {
		return err
	}
	if !ok {
		return ErrTooManyLoginAttempts
	}
	return nil
}

var saveInvalidLoginAttempt = func(ctx context.Context, query *models.LoginUserQuery, loginAttemptService loginattempt.Service) error {
	return loginAttemptService.RecordAttempts(ctx, query.Username, query.IpAddress)
}
