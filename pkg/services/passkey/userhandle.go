package passkey

import "encoding/binary"

// UserHandleLen is the fixed byte length of an encoded WebAuthn user handle.
const UserHandleLen = 8

// EncodeUserHandle encodes a Grafana user ID as the opaque WebAuthn user handle (WebAuthnID). It uses
// a fixed 8-byte big-endian representation that round-trips byte-for-byte when an authenticator
// returns the handle on an assertion. The encoding must stay stable: changing it would orphan every
// previously enrolled credential.
func EncodeUserHandle(userID int64) []byte {
	b := make([]byte, UserHandleLen)
	binary.BigEndian.PutUint64(b, uint64(userID))
	return b
}
