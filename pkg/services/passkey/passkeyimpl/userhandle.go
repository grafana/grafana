package passkeyimpl

import (
	"encoding/binary"
	"fmt"
)

// userHandleLen is the fixed byte length of an encoded WebAuthn user handle.
const userHandleLen = 8

// encodeUserHandle encodes a Grafana user id as the opaque WebAuthn user handle returned at
// registration (WebAuthnID). It uses a fixed 8-byte big-endian representation so the value
// round-trips byte-for-byte when the authenticator hands it back on an assertion. The encoding
// must stay stable: changing it would orphan every previously enrolled credential.
func encodeUserHandle(userID int64) []byte {
	b := make([]byte, userHandleLen)
	binary.BigEndian.PutUint64(b, uint64(userID))
	return b
}

// decodeUserHandle reverses encodeUserHandle, returning the Grafana user id carried by a WebAuthn
// assertion's user handle. It errors if the handle is not exactly userHandleLen bytes.
func decodeUserHandle(b []byte) (int64, error) {
	if len(b) != userHandleLen {
		return 0, fmt.Errorf("invalid user handle length: got %d bytes, want %d", len(b), userHandleLen)
	}
	return int64(binary.BigEndian.Uint64(b)), nil
}
