package passkeyimpl

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/go-webauthn/webauthn/protocol"
	wan "github.com/go-webauthn/webauthn/webauthn"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// sessionIDLength is the length of the opaque, crypto-random id that keys a ceremony's challenge in
// the cache. The challenge itself is the security-critical secret; this id only needs to be
// unguessable enough that an attacker can't target another in-flight ceremony.
const sessionIDLength = 40

var _ passkey.Service = (*Service)(nil)

// errDisabled is returned if a ceremony method is reached while passkey auth is off. The authn client
// (B10) and handlers (B14) gate on the enabled flag, so this is defence in depth, not the main guard.
var errDisabled = errors.New("passkey auth is not enabled")

type Service struct {
	wa      *wan.WebAuthn
	store   passkey.Store
	cache   *challengeStore
	cfg     setting.PasskeySettings
	metrics *metrics
	log     log.Logger
}

func ProvideService(cfg *setting.Cfg, store passkey.Store, remoteCache *remotecache.RemoteCache, reg prometheus.Registerer) (*Service, error) {
	return newService(cfg.Passkey, store, remoteCache, reg)
}

// newService builds the service from settings. It takes the cacheStorage interface (not the concrete
// remotecache) so tests can supply an in-memory fake. When passkey auth is disabled it skips
// webauthn.New (which requires a valid RP config) so the server still boots with the feature off.
func newService(settings setting.PasskeySettings, store passkey.Store, cache cacheStorage, reg prometheus.Registerer) (*Service, error) {
	s := &Service{
		store:   store,
		cache:   newChallengeStore(cache),
		cfg:     settings,
		metrics: newMetrics(reg),
		log:     log.New("passkey.service"),
	}

	if settings.Enabled {
		wa, err := wan.New(buildConfig(settings))
		if err != nil {
			return nil, fmt.Errorf("failed to initialize webauthn: %w", err)
		}
		s.wa = wa
	}

	return s, nil
}

// buildConfig maps Grafana's passkey settings onto the go-webauthn config. Resident keys are required
// because passkeys are discoverable credentials (usernameless login). User verification is required
// only when the operator asks for it; the library reads this for both login and registration.
func buildConfig(s setting.PasskeySettings) *wan.Config {
	cfg := &wan.Config{
		RPID:          s.RPID,
		RPDisplayName: s.RPName,
		RPOrigins:     s.RPOrigins,
	}
	cfg.AuthenticatorSelection.ResidentKey = protocol.ResidentKeyRequirementRequired
	if s.RequireUserVerification {
		cfg.AuthenticatorSelection.UserVerification = protocol.VerificationRequired
	}
	return cfg
}

func (s *Service) BeginLogin(ctx context.Context) (*passkey.BeginResult, error) {
	if s.wa == nil {
		return nil, errDisabled
	}
	assertion, session, err := s.wa.BeginDiscoverableLogin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin passkey login: %w", err)
	}
	// Send the inner options object (PublicKeyCredentialRequestOptions), not the {"publicKey": …}
	// wrapper, because @simplewebauthn/browser's startAuthentication consumes the options directly.
	res, err := s.persistSession(ctx, session, assertion.Response)
	if err != nil {
		return nil, err
	}
	s.metrics.loginBegin.Inc()
	return res, nil
}

func (s *Service) FinishLogin(ctx context.Context, sessionID string, responseBody []byte) (int64, error) {
	if s.wa == nil {
		return 0, errDisabled
	}
	session, err := s.loadSession(ctx, sessionID)
	if err != nil {
		return 0, err // ErrChallengeExpired passes through
	}

	parsed, err := protocol.ParseCredentialRequestResponseBytes(responseBody)
	if err != nil {
		return 0, s.failLogin()
	}

	// The handler runs during validation: it decodes the user handle the authenticator returned,
	// loads that user's credentials, and hands them to the library to verify the assertion against.
	// We capture the resolved id and stored credentials so we can persist the new sign count after.
	var (
		resolvedUserID int64
		storedCreds    []*passkey.Credential
	)
	handler := func(rawID, userHandle []byte) (wan.User, error) {
		uid, err := decodeUserHandle(userHandle)
		if err != nil {
			return nil, err
		}
		creds, err := s.store.ListByUser(ctx, uid)
		if err != nil {
			return nil, err
		}
		if len(creds) == 0 {
			return nil, passkey.ErrCredentialNotFound
		}
		resolvedUserID, storedCreds = uid, creds
		return newWebAuthnUser(uid, "", "", creds), nil
	}

	_, credential, err := s.wa.ValidatePasskeyLogin(handler, *session, parsed)
	if err != nil {
		return 0, s.failLogin()
	}

	// The library sets CloneWarning when the reported counter regressed (<= stored, unless both 0),
	// which means a possible cloned credential. Reject and do not advance the stored counter.
	if credential.Authenticator.CloneWarning {
		s.metrics.signCountRegressions.Inc()
		return 0, s.failLogin()
	}

	s.recordUse(ctx, storedCreds, credential)
	s.metrics.loginFinish.WithLabelValues(resultSuccess).Inc()
	return resolvedUserID, nil
}

func (s *Service) BeginRegistration(ctx context.Context, ru passkey.RegisteringUser) (*passkey.BeginResult, error) {
	if s.wa == nil {
		return nil, errDisabled
	}
	existing, err := s.store.ListByUser(ctx, ru.UserID)
	if err != nil {
		return nil, err
	}
	user := newWebAuthnUser(ru.UserID, ru.Name, ru.DisplayName, existing)

	// Exclude already-registered credentials so the same authenticator can't be enrolled twice.
	opts := []wan.RegistrationOption{
		wan.WithExclusions(wan.Credentials(user.WebAuthnCredentials()).CredentialDescriptors()),
	}
	creation, session, err := s.wa.BeginRegistration(user, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to begin passkey registration: %w", err)
	}
	// Send the inner options object (PublicKeyCredentialCreationOptions), not the {"publicKey": …}
	// wrapper, because @simplewebauthn/browser's startRegistration consumes the options directly.
	res, err := s.persistSession(ctx, session, creation.Response)
	if err != nil {
		return nil, err
	}
	s.metrics.registrationBegin.Inc()
	return res, nil
}

func (s *Service) FinishRegistration(ctx context.Context, sessionID string, ru passkey.RegisteringUser, name string, responseBody []byte) (*passkey.Credential, error) {
	if s.wa == nil {
		return nil, errDisabled
	}
	session, err := s.loadSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	existing, err := s.store.ListByUser(ctx, ru.UserID)
	if err != nil {
		return nil, err
	}
	user := newWebAuthnUser(ru.UserID, ru.Name, ru.DisplayName, existing)

	parsed, err := protocol.ParseCredentialCreationResponseBytes(responseBody)
	if err != nil {
		s.metrics.registrationFinish.WithLabelValues(resultFailure).Inc()
		return nil, err
	}

	credential, err := s.wa.CreateCredential(user, *session, parsed)
	if err != nil {
		s.metrics.registrationFinish.WithLabelValues(resultFailure).Inc()
		return nil, err
	}

	stored := toStoreCredential(ru.UserID, name, credential)
	if err := s.store.Create(ctx, stored); err != nil {
		s.metrics.registrationFinish.WithLabelValues(resultFailure).Inc()
		return nil, err
	}

	s.metrics.registrationFinish.WithLabelValues(resultSuccess).Inc()
	return stored, nil
}

// persistSession stores the ceremony's SessionData under a fresh opaque id and returns it together
// with the begin options (raw JSON) the client needs for navigator.credentials.*.
func (s *Service) persistSession(ctx context.Context, session *wan.SessionData, options any) (*passkey.BeginResult, error) {
	data, err := json.Marshal(session)
	if err != nil {
		return nil, err
	}
	sessionID, err := util.GetRandomString(sessionIDLength)
	if err != nil {
		return nil, err
	}
	if err := s.cache.set(ctx, sessionID, data); err != nil {
		return nil, fmt.Errorf("failed to store passkey challenge: %w", err)
	}
	opts, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}
	return &passkey.BeginResult{SessionID: sessionID, Options: opts}, nil
}

// loadSession loads and single-use-deletes the ceremony state. An unknown/expired id maps to the
// caller-facing ErrChallengeExpired.
func (s *Service) loadSession(ctx context.Context, sessionID string) (*wan.SessionData, error) {
	data, err := s.cache.take(ctx, sessionID)
	if err != nil {
		if errors.Is(err, remotecache.ErrCacheItemNotFound) {
			return nil, passkey.ErrChallengeExpired
		}
		return nil, err
	}
	var session wan.SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

// recordUse persists the advanced sign counter for the credential that signed the assertion. A
// failure here is logged but not fatal: the login already succeeded and the worst case is the next
// login compares against a slightly stale counter.
func (s *Service) recordUse(ctx context.Context, stored []*passkey.Credential, used *wan.Credential) {
	for _, c := range stored {
		if bytes.Equal(c.CredentialID, used.ID) {
			if err := s.store.RecordUse(ctx, c.ID, int64(used.Authenticator.SignCount)); err != nil {
				s.log.Warn("failed to record passkey use", "credentialID", c.ID, "err", err)
			}
			return
		}
	}
}

// failLogin records a failed login finish and returns the uniform error (no enumeration).
func (s *Service) failLogin() error {
	s.metrics.loginFinish.WithLabelValues(resultFailure).Inc()
	return passkey.ErrLoginFailed
}
