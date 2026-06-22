package passkey

import "time"

// Credential is a single WebAuthn passkey enrolled by a user. It maps to the user_passkey_credential
// table. CredentialIDHash holds the hex SHA-256 of CredentialID and exists only to carry the unique
// index (a binary unique index is not portable across MySQL); the store derives it, callers don't.
type Credential struct {
	ID               int64      `xorm:"pk autoincr 'id'"`
	UserID           int64      `xorm:"user_id"`
	CredentialID     []byte     `xorm:"credential_id"`
	CredentialIDHash string     `xorm:"credential_id_hash"`
	PublicKey        []byte     `xorm:"public_key"`
	AAGUID           []byte     `xorm:"aaguid"`
	SignCount        int64      `xorm:"sign_count"`
	BackupEligible   bool       `xorm:"backup_eligible"`
	Transports       string     `xorm:"transports"`
	AttestationType  string     `xorm:"attestation_type"`
	Name             string     `xorm:"name"`
	Created          time.Time  // maps to column "created"; set by the store on Create
	LastUsed         *time.Time `xorm:"last_used"`
}

func (Credential) TableName() string { return "user_passkey_credential" }
