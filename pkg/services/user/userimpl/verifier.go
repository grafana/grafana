package userimpl

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/notifications"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var _ user.Verifier = (*Verifier)(nil)

func ProvideVerifier(us user.Service, ts tempuser.Service, ns notifications.Service) *Verifier {
	return &Verifier{us, ts, ns}
}

type Verifier struct {
	us user.Service
	ts tempuser.Service
	ns notifications.Service
}

func (s *Verifier) VerifyEmail(ctx context.Context, cmd user.VerifyEmailCommand) error {
	usr, err := s.us.GetByLogin(ctx, &user.GetUserByLoginQuery{
		LoginOrEmail: cmd.Email,
	})

	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		return err
	}

	// if email is already used by another user we stop here
	if usr != nil && usr.ID != cmd.User.ID {
		return user.ErrEmailConflict.Errorf("email already used")
	}

	code, err := util.GetRandomString(20)
	if err != nil {
		return fmt.Errorf("failed to generate verification code: %w", err)
	}

	// invalidate any pending verifications for user
	if err = s.ts.ExpirePreviousVerifications(
		ctx, &tempuser.ExpirePreviousVerificationsCommand{InvitedByUserID: cmd.User.ID},
	); err != nil {
		return fmt.Errorf("failed to expire previous verifications: %w", err)
	}

	tmpUsr, err := s.ts.CreateTempUser(ctx, &tempuser.CreateTempUserCommand{
		OrgID: -1,
		// used to determine if the user was updating their email or username in the second step of the verification flow
		Name: string(cmd.Action),
		// used to fetch the User in the second step of the verification flow
		InvitedByUserID: cmd.User.ID,
		Email:           cmd.Email,
		Code:            code,
		Status:          tempuser.TmpUserEmailUpdateStarted,
	})

	if err != nil {
		return fmt.Errorf("failed to generate temp user for email verification: %w", err)
	}

	if err := s.ns.SendVerificationEmail(ctx, &notifications.SendVerifyEmailCommand{
		User:  &cmd.User,
		Code:  tmpUsr.Code,
		Email: cmd.Email,
	}); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	if err := s.ts.UpdateTempUserWithEmailSent(ctx, &tempuser.UpdateTempUserWithEmailSentCommand{
		Code: tmpUsr.Code,
	}); err != nil {
		return fmt.Errorf("failed to mark email as sent: %w", err)
	}

	return nil
}
