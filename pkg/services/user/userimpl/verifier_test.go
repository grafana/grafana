package userimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth/idtest"
	"github.com/grafana/grafana/pkg/services/notifications"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempusertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestVerifier_Start(t *testing.T) {
	ts := &tempusertest.FakeTempUserService{}
	us := &usertest.FakeUserService{}
	ns := notifications.MockNotificationService()
	is := &idtest.FakeService{}

	type calls struct {
		expireCalled bool
		createCalled bool
		updateCalled bool
	}

	verifier := ProvideVerifier(setting.ProvideService(setting.NewCfg()), us, ts, ns, is)
	t.Run("should error if email already exist for other user", func(t *testing.T) {
		us.ExpectedUser = &user.User{ID: 1}
		err := verifier.Start(context.Background(), user.StartVerifyEmailCommand{
			User:   user.User{ID: 2},
			Email:  "some@email.com",
			Action: user.EmailUpdateAction,
		})

		assert.ErrorIs(t, err, user.ErrEmailConflict)
	})

	t.Run("should succeed when no user has the email", func(t *testing.T) {
		us.ExpectedUser = nil
		var c calls
		ts.ExpirePreviousVerificationsFN = func(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error {
			c.expireCalled = true
			return nil
		}

		ts.CreateTempUserFN = func(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error) {
			c.createCalled = true
			return &tempuser.TempUser{
				OrgID:           cmd.OrgID,
				Email:           cmd.Email,
				Name:            cmd.Name,
				InvitedByUserID: cmd.InvitedByUserID,
				Code:            cmd.Code,
			}, nil
		}

		ts.UpdateTempUserWithEmailSentFN = func(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
			c.updateCalled = true
			return nil
		}
		err := verifier.Start(context.Background(), user.StartVerifyEmailCommand{
			User:   user.User{ID: 2},
			Email:  "some@email.com",
			Action: user.EmailUpdateAction,
		})

		assert.NoError(t, err)
		assert.True(t, c.expireCalled)
		assert.True(t, c.createCalled)
		assert.True(t, c.updateCalled)
	})

	t.Run("should succeed when the user holding the email is the same user that want to verify it", func(t *testing.T) {
		us.ExpectedUser = &user.User{ID: 2}
		var c calls
		ts.ExpirePreviousVerificationsFN = func(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error {
			c.expireCalled = true
			return nil
		}

		ts.CreateTempUserFN = func(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error) {
			c.createCalled = true
			return &tempuser.TempUser{
				OrgID:           cmd.OrgID,
				Email:           cmd.Email,
				Name:            cmd.Name,
				InvitedByUserID: cmd.InvitedByUserID,
				Code:            cmd.Code,
			}, nil
		}

		ts.UpdateTempUserWithEmailSentFN = func(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
			c.updateCalled = true
			return nil
		}
		err := verifier.Start(context.Background(), user.StartVerifyEmailCommand{
			User:   user.User{ID: 2},
			Email:  "some@email.com",
			Action: user.EmailUpdateAction,
		})

		assert.ErrorIs(t, err, nil)
		assert.True(t, c.expireCalled)
		assert.True(t, c.createCalled)
		assert.True(t, c.updateCalled)
	})
}

func TestVerifier_Complete(t *testing.T) {
	ts := &tempusertest.FakeTempUserService{}
	us := &usertest.FakeUserService{}
	ns := notifications.MockNotificationService()
	is := &idtest.FakeService{}

	type calls struct {
		updateCalled       bool
		updateStatusCalled bool
		removeTokenCalled  bool
	}

	cfg := setting.NewCfg()
	cfg.VerificationEmailMaxLifetime = 1 * time.Hour
	verifier := ProvideVerifier(setting.ProvideService(cfg), us, ts, ns, is)
	t.Run("should return error for invalid code", func(t *testing.T) {
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return nil, tempuser.ErrTempUserNotFound
		}
		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.ErrorIs(t, err, errInvalidCode)
	})

	t.Run("should return error when verification has wrong status", func(t *testing.T) {
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status: tempuser.TmpUserEmailUpdateCompleted,
			}, nil
		}
		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.ErrorIs(t, err, errInvalidCode)
	})

	t.Run("should return error when verification email was never sent", func(t *testing.T) {
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status:    tempuser.TmpUserEmailUpdateStarted,
				EmailSent: false,
			}, nil
		}
		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.ErrorIs(t, err, errInvalidCode)
	})

	t.Run("should return error when verification code has expired", func(t *testing.T) {
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status:      tempuser.TmpUserEmailUpdateStarted,
				EmailSent:   true,
				EmailSentOn: time.Now().Add(-10 * time.Hour),
			}, nil
		}
		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.ErrorIs(t, err, errExpiredCode)
	})

	t.Run("should return error user connect to code don't exists", func(t *testing.T) {
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status:      tempuser.TmpUserEmailUpdateStarted,
				EmailSent:   true,
				EmailSentOn: time.Now(),
			}, nil
		}
		us.ExpectedError = user.ErrUserNotFound

		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.ErrorIs(t, err, user.ErrUserNotFound)
	})

	t.Run("should update user email on valid code", func(t *testing.T) {
		var c calls
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status:      tempuser.TmpUserEmailUpdateStarted,
				Name:        string(user.EmailUpdateAction),
				InvitedByID: 1,
				Email:       "updated@email.com",
				EmailSent:   true,
				EmailSentOn: time.Now(),
			}, nil
		}

		ts.UpdateTempUserStatusFN = func(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error {
			c.updateStatusCalled = true
			return nil
		}

		is.RemoveIDTokenFn = func(ctx context.Context, identity identity.Requester) error {
			c.removeTokenCalled = true
			return nil
		}

		us.ExpectedUser = &user.User{Email: "initial@email.com"}
		us.ExpectedError = nil
		us.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
			c.updateCalled = true
			assert.True(t, *cmd.EmailVerified)
			assert.Equal(t, int64(1), cmd.UserID)
			assert.Equal(t, "", cmd.Login)
			assert.Equal(t, "updated@email.com", cmd.Email)
			return nil
		}

		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.NoError(t, err)
		assert.True(t, c.updateCalled)
		assert.True(t, c.updateStatusCalled)
		assert.True(t, c.removeTokenCalled)
	})

	t.Run("should update user email and login if login is an email on valid code", func(t *testing.T) {
		var c calls
		ts.GetTempUserByCodeFN = func(ctx context.Context, query *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
			return &tempuser.TempUserDTO{
				Status:      tempuser.TmpUserEmailUpdateStarted,
				Name:        string(user.EmailUpdateAction),
				InvitedByID: 1,
				Email:       "updated@email.com",
				EmailSent:   true,
				EmailSentOn: time.Now(),
			}, nil
		}

		ts.UpdateTempUserStatusFN = func(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error {
			c.updateStatusCalled = true
			return nil
		}

		is.RemoveIDTokenFn = func(ctx context.Context, identity identity.Requester) error {
			c.removeTokenCalled = true
			return nil
		}

		us.ExpectedUser = &user.User{Email: "initial@email.com", Login: "other@email.com"}
		us.ExpectedError = nil
		us.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
			c.updateCalled = true
			assert.True(t, *cmd.EmailVerified)
			assert.Equal(t, int64(1), cmd.UserID)
			assert.Equal(t, "updated@email.com", cmd.Email)
			assert.Equal(t, "updated@email.com", cmd.Login)
			return nil
		}

		err := verifier.Complete(context.Background(), user.CompleteEmailVerifyCommand{Code: "some-code"})
		assert.NoError(t, err)
		assert.True(t, c.updateCalled)
		assert.True(t, c.updateStatusCalled)
		assert.True(t, c.removeTokenCalled)
	})
}
