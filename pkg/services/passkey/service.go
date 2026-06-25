package passkey

import (
	"context"
	"encoding/json"
	"errors"
)

// ErrChallengeExpired is returned by finish operations when the sessionID is unknown, already used,
// or expired. Handlers map it to 410 Gone with the "passkey.challenge-expired" message.
var ErrChallengeExpired = errors.New("passkey challenge expired")

// ErrLoginFailed is the uniform error returned for every login-finish failure other than an expired
// challenge. Returning one error for "no such credential", "bad signature", and "clone detected"
// alike keeps the finish endpoint from revealing whether a credential exists (no enumeration).
var ErrLoginFailed = errors.New("passkey login failed")

// RegisteringUser identifies the already-authenticated user enrolling a new passkey. Name and
// DisplayName are shown by the authenticator UI; UserID is encoded into the WebAuthn user handle.
type RegisteringUser struct {
	UserID      int64
	Name        string
	DisplayName string
}

// EnrollSource records which anonymous flow started a passkey enrollment, so the finish step can run
// the right post-step (complete signup, apply an invite's org membership, finish bootstrap).
type EnrollSource string

const (
	EnrollSourceSignup    EnrollSource = "signup"
	EnrollSourceInvite    EnrollSource = "invite"
	EnrollSourceBootstrap EnrollSource = "bootstrap"
)

// BeginResult carries the public-key options the browser hands to navigator.credentials.*, plus the
// opaque sessionID that ties the begin and finish halves of one ceremony together. Options is raw
// JSON produced by go-webauthn and passed through to the client untouched.
type BeginResult struct {
	SessionID string
	Options   json.RawMessage
}

// Service runs the WebAuthn begin/finish ceremonies for passkey login and registration. It wraps the
// go-webauthn library and is the only place ceremony state and security policy (user verification,
// sign-count regression, no enumeration) are enforced.
type Service interface {
	// BeginLogin starts a usernameless (discoverable) login ceremony.
	BeginLogin(ctx context.Context) (*BeginResult, error)

	// FinishLogin verifies the assertion in responseBody against the stored challenge and returns the
	// authenticated user's id. It returns ErrChallengeExpired for an unknown/expired sessionID and
	// ErrLoginFailed for every other failure.
	FinishLogin(ctx context.Context, sessionID string, responseBody []byte) (userID int64, err error)

	// BeginRegistration starts enrolling a new passkey for an already-authenticated user.
	BeginRegistration(ctx context.Context, user RegisteringUser) (*BeginResult, error)

	// BeginEnrollment starts enrolling the first passkey for a user via an anonymous flow (signup,
	// invite, bootstrap) where there is no session. The pending state carries the user's id and the
	// source so the anonymous finish can persist the credential and run the right post-step.
	BeginEnrollment(ctx context.Context, user RegisteringUser, source EnrollSource) (*BeginResult, error)

	// FinishEnrollment verifies the attestation in responseBody against the pending enrollment for
	// sessionID, persists the credential under name, and returns the enrolled user's id and the source
	// flow so the caller can run the right post-step. Returns ErrChallengeExpired for an unknown/expired
	// sessionID.
	FinishEnrollment(ctx context.Context, sessionID, name string, responseBody []byte) (userID int64, source EnrollSource, err error)

	// FinishRegistration verifies the attestation in responseBody against the stored challenge and
	// persists the new credential under name. It returns ErrChallengeExpired for an expired sessionID.
	FinishRegistration(ctx context.Context, sessionID string, user RegisteringUser, name string, responseBody []byte) (*Credential, error)
}
