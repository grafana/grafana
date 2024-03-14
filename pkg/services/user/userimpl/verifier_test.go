package userimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/notifications"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempusertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func TestVerifier_VerifyEmail(t *testing.T) {
	ts := &tempusertest.FakeTempUserService{}
	us := &usertest.FakeUserService{}
	ns := notifications.MockNotificationService()

	type calls struct {
		expireCalled bool
		createCalled bool
		updateCalled bool
	}

	verifier := ProvideVerifier(us, ts, ns)
	t.Run("should error if email already exist for other user", func(t *testing.T) {
		us.ExpectedUser = &user.User{ID: 1}
		err := verifier.VerifyEmail(context.Background(), user.VerifyEmailCommand{
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
		err := verifier.VerifyEmail(context.Background(), user.VerifyEmailCommand{
			User:   user.User{ID: 2},
			Email:  "some@email.com",
			Action: user.EmailUpdateAction,
		})

		assert.ErrorIs(t, err, nil)
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
		err := verifier.VerifyEmail(context.Background(), user.VerifyEmailCommand{
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
