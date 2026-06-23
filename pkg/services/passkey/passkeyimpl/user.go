package passkeyimpl

import (
	"strings"

	"github.com/go-webauthn/webauthn/protocol"
	wan "github.com/go-webauthn/webauthn/webauthn"

	"github.com/grafana/grafana/pkg/services/passkey"
)

// webAuthnUser adapts a Grafana user and their stored credentials to the go-webauthn User interface.
// The library uses WebAuthnID (our big-endian user handle) to bind an assertion to an account, and
// WebAuthnCredentials to find the credential that signed it.
type webAuthnUser struct {
	id          int64
	name        string
	displayName string
	credentials []wan.Credential
}

func newWebAuthnUser(id int64, name, displayName string, creds []*passkey.Credential) *webAuthnUser {
	wcreds := make([]wan.Credential, 0, len(creds))
	for _, c := range creds {
		wcreds = append(wcreds, toWebAuthnCredential(c))
	}
	return &webAuthnUser{id: id, name: name, displayName: displayName, credentials: wcreds}
}

func (u *webAuthnUser) WebAuthnID() []byte                    { return encodeUserHandle(u.id) }
func (u *webAuthnUser) WebAuthnName() string                  { return u.name }
func (u *webAuthnUser) WebAuthnDisplayName() string           { return u.displayName }
func (u *webAuthnUser) WebAuthnCredentials() []wan.Credential { return u.credentials }

// toWebAuthnCredential converts a stored credential into the library type the verifier checks an
// assertion against. Only the fields the library reads during validation are populated.
func toWebAuthnCredential(c *passkey.Credential) wan.Credential {
	return wan.Credential{
		ID:              c.CredentialID,
		PublicKey:       c.PublicKey,
		AttestationType: c.AttestationType,
		Transport:       parseTransports(c.Transports),
		Flags:           wan.CredentialFlags{BackupEligible: c.BackupEligible},
		Authenticator: wan.Authenticator{
			AAGUID:    c.AAGUID,
			SignCount: uint32(c.SignCount),
		},
	}
}

// toStoreCredential converts a freshly registered library credential into our persistence model.
func toStoreCredential(userID int64, name string, c *wan.Credential) *passkey.Credential {
	return &passkey.Credential{
		UserID:          userID,
		CredentialID:    c.ID,
		PublicKey:       c.PublicKey,
		AAGUID:          c.Authenticator.AAGUID,
		SignCount:       int64(c.Authenticator.SignCount),
		BackupEligible:  c.Flags.BackupEligible,
		Transports:      joinTransports(c.Transport),
		AttestationType: c.AttestationType,
		Name:            name,
	}
}

// parseTransports turns the stored comma-separated transport list back into the library's slice type.
func parseTransports(s string) []protocol.AuthenticatorTransport {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	transports := make([]protocol.AuthenticatorTransport, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			transports = append(transports, protocol.AuthenticatorTransport(p))
		}
	}
	return transports
}

// joinTransports renders the library's transport slice as the comma-separated form we persist.
func joinTransports(transports []protocol.AuthenticatorTransport) string {
	if len(transports) == 0 {
		return ""
	}
	parts := make([]string, len(transports))
	for i, t := range transports {
		parts[i] = string(t)
	}
	return strings.Join(parts, ",")
}
