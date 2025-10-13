package tempusertest

import (
	"context"

	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

var _ tempuser.Service = (*FakeTempUserService)(nil)

type FakeTempUserService struct {
	tempuser.Service
	GetTempUserByCodeFN           func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error)
	GetTempUsersQueryFN           func(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error)
	UpdateTempUserStatusFN        func(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error
	CreateTempUserFN              func(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error)
	ExpirePreviousVerificationsFN func(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error
	UpdateTempUserWithEmailSentFN func(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error
}

func (f *FakeTempUserService) GetTempUserByCode(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
	if f.GetTempUserByCodeFN != nil {
		return f.GetTempUserByCodeFN(ctx, query)
	}
	return nil, nil
}

func (f *FakeTempUserService) GetTempUsersQuery(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
	if f.GetTempUsersQueryFN != nil {
		return f.GetTempUsersQueryFN(ctx, query)
	}
	return nil, nil
}

func (f *FakeTempUserService) UpdateTempUserStatus(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error {
	if f.UpdateTempUserStatusFN != nil {
		return f.UpdateTempUserStatusFN(ctx, cmd)
	}
	return nil
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
