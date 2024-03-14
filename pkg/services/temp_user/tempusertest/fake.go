package tempusertest

import (
	"context"

	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

var _ tempuser.Service = (*FakeTempUserService)(nil)

type FakeTempUserService struct {
	tempuser.Service
	CreateTempUserFN              func(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error)
	ExpirePreviousVerificationsFN func(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error
	UpdateTempUserWithEmailSentFN func(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error
}

func (f *FakeTempUserService) CreateTempUser(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error) {
	if f.CreateTempUserFN != nil {
		return f.CreateTempUserFN(ctx, cmd)
	}
	return nil, nil
}

func (f *FakeTempUserService) ExpirePreviousVerifications(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error {
	if f.ExpirePreviousVerificationsFN != nil {
		return f.ExpirePreviousVerificationsFN(ctx, cmd)
	}
	return nil
}

func (f *FakeTempUserService) UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
	if f.UpdateTempUserWithEmailSentFN != nil {
		return f.UpdateTempUserWithEmailSentFN(ctx, cmd)
	}
	return nil
}
