package passkeyimpl

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/go-webauthn/webauthn/protocol"
	wan "github.com/go-webauthn/webauthn/webauthn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/setting"
)

func validSettings() setting.PasskeySettings {
	return setting.PasskeySettings{
		Enabled:                 true,
		RPID:                    "grafana.example.com",
		RPName:                  "Grafana",
		RPOrigins:               []string{"https://grafana.example.com"},
		RequireUserVerification: true,
	}
}

func TestBuildConfig(t *testing.T) {
	t.Run("maps relying-party settings and requires resident keys", func(t *testing.T) {
		cfg := buildConfig(validSettings())
		require.Equal(t, "grafana.example.com", cfg.RPID)
		require.Equal(t, "Grafana", cfg.RPDisplayName)
		require.Equal(t, []string{"https://grafana.example.com"}, cfg.RPOrigins)
		// Passkeys are discoverable credentials, so resident keys must be required.
		require.Equal(t, protocol.ResidentKeyRequirementRequired, cfg.AuthenticatorSelection.ResidentKey)
	})

	t.Run("requires user verification only when configured", func(t *testing.T) {
		cfg := buildConfig(validSettings())
		require.Equal(t, protocol.VerificationRequired, cfg.AuthenticatorSelection.UserVerification)

		s := validSettings()
		s.RequireUserVerification = false
		cfg = buildConfig(s)
		require.NotEqual(t, protocol.VerificationRequired, cfg.AuthenticatorSelection.UserVerification)
	})
}

func TestNewService(t *testing.T) {
	t.Run("enabled with valid config initializes webauthn", func(t *testing.T) {
		s, err := newService(validSettings(), nil, newFakeCache(), nil)
		require.NoError(t, err)
		require.NotNil(t, s.wa)
	})

	t.Run("enabled with invalid config returns an error", func(t *testing.T) {
		// go-webauthn requires at least one origin; this is the backstop behind B3's stricter
		// startup validation, so an enabled service with no origins must fail to construct.
		bad := validSettings()
		bad.RPOrigins = nil
		_, err := newService(bad, nil, newFakeCache(), nil)
		require.Error(t, err)
	})

	t.Run("disabled boots without initializing webauthn", func(t *testing.T) {
		s := validSettings()
		s.Enabled = false
		svc, err := newService(s, nil, newFakeCache(), nil)
		require.NoError(t, err)
		require.Nil(t, svc.wa)
	})
}

func TestServiceDisabledRejectsCeremonies(t *testing.T) {
	s := validSettings()
	s.Enabled = false
	svc, err := newService(s, nil, newFakeCache(), nil)
	require.NoError(t, err)

	ctx := context.Background()
	_, err = svc.BeginLogin(ctx)
	require.ErrorIs(t, err, errDisabled)

	_, err = svc.FinishLogin(ctx, "sess", []byte("{}"))
	require.ErrorIs(t, err, errDisabled)

	_, err = svc.BeginRegistration(ctx, passkey.RegisteringUser{UserID: 1})
	require.ErrorIs(t, err, errDisabled)

	_, err = svc.FinishRegistration(ctx, "sess", passkey.RegisteringUser{UserID: 1}, "Key", []byte("{}"))
	require.ErrorIs(t, err, errDisabled)
}

func TestSessionRoundTrip(t *testing.T) {
	ctx := context.Background()
	svc, err := newService(validSettings(), nil, newFakeCache(), nil)
	require.NoError(t, err)

	original := &wan.SessionData{
		Challenge:        "a-random-challenge-value",
		RelyingPartyID:   "grafana.example.com",
		UserVerification: protocol.VerificationRequired,
	}

	res, err := svc.persistSession(ctx, original, map[string]string{"publicKey": "options"})
	require.NoError(t, err)
	require.NotEmpty(t, res.SessionID)
	require.True(t, json.Valid(res.Options), "begin options must be valid JSON for the client")

	loaded, err := svc.loadSession(ctx, res.SessionID)
	require.NoError(t, err)
	require.Equal(t, original.Challenge, loaded.Challenge)
	require.Equal(t, original.RelyingPartyID, loaded.RelyingPartyID)
	require.Equal(t, original.UserVerification, loaded.UserVerification)
}

func TestLoadSessionUnknownMapsToExpired(t *testing.T) {
	ctx := context.Background()
	svc, err := newService(validSettings(), nil, newFakeCache(), nil)
	require.NoError(t, err)

	_, err = svc.loadSession(ctx, "never-stored")
	require.ErrorIs(t, err, passkey.ErrChallengeExpired)
}

func TestSessionIsSingleUse(t *testing.T) {
	ctx := context.Background()
	svc, err := newService(validSettings(), nil, newFakeCache(), nil)
	require.NoError(t, err)

	res, err := svc.persistSession(ctx, &wan.SessionData{Challenge: "c"}, struct{}{})
	require.NoError(t, err)

	_, err = svc.loadSession(ctx, res.SessionID)
	require.NoError(t, err)

	// A replayed finish must not find the challenge again.
	_, err = svc.loadSession(ctx, res.SessionID)
	require.ErrorIs(t, err, passkey.ErrChallengeExpired)
}

func TestWebAuthnUserAdapter(t *testing.T) {
	creds := []*passkey.Credential{
		{CredentialID: []byte("cred-1"), PublicKey: []byte("pk-1"), SignCount: 5, BackupEligible: true, Transports: "usb,nfc", AAGUID: []byte("aaguid")},
	}
	user := newWebAuthnUser(42, "alice", "Alice Example", creds)

	// The user handle must be the byte-identical encoding used at registration and login.
	require.Equal(t, encodeUserHandle(42), user.WebAuthnID())
	require.Equal(t, "alice", user.WebAuthnName())
	require.Equal(t, "Alice Example", user.WebAuthnDisplayName())
	require.Len(t, user.WebAuthnCredentials(), 1)

	wc := user.WebAuthnCredentials()[0]
	require.Equal(t, []byte("cred-1"), wc.ID)
	require.Equal(t, []byte("pk-1"), wc.PublicKey)
	require.EqualValues(t, 5, wc.Authenticator.SignCount)
	require.True(t, wc.Flags.BackupEligible)
	require.Equal(t, []protocol.AuthenticatorTransport{"usb", "nfc"}, wc.Transport)
}

func TestCredentialConversionRoundTrip(t *testing.T) {
	lib := &wan.Credential{
		ID:              []byte("cred-id"),
		PublicKey:       []byte("public-key"),
		AttestationType: "none",
		Transport:       []protocol.AuthenticatorTransport{"internal", "hybrid"},
		Flags:           wan.CredentialFlags{BackupEligible: true},
		Authenticator:   wan.Authenticator{AAGUID: []byte("aaguid"), SignCount: 9},
	}

	stored := toStoreCredential(7, "My Key", lib)
	require.EqualValues(t, 7, stored.UserID)
	require.Equal(t, "My Key", stored.Name)
	require.Equal(t, "internal,hybrid", stored.Transports)

	back := toWebAuthnCredential(stored)
	require.Equal(t, lib.ID, back.ID)
	require.Equal(t, lib.PublicKey, back.PublicKey)
	require.Equal(t, lib.AttestationType, back.AttestationType)
	require.Equal(t, lib.Transport, back.Transport)
	require.Equal(t, lib.Authenticator.AAGUID, back.Authenticator.AAGUID)
	require.Equal(t, lib.Authenticator.SignCount, back.Authenticator.SignCount)
	require.Equal(t, lib.Flags.BackupEligible, back.Flags.BackupEligible)
}

func TestTransportsRoundTrip(t *testing.T) {
	require.Nil(t, parseTransports(""))
	require.Equal(t, "", joinTransports(nil))
	require.Equal(t, []protocol.AuthenticatorTransport{"usb", "ble"}, parseTransports("usb, ble"))
	require.Equal(t, "usb,ble", joinTransports([]protocol.AuthenticatorTransport{"usb", "ble"}))
}
