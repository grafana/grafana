package passkeyimpl

import (
	"encoding/binary"
	"fmt"

	"github.com/grafana/grafana/pkg/services/passkey"
)

// encodeUserHandle delegates to the canonical implementation in the passkey domain package so the
// encoding is defined in exactly one place. See passkey.EncodeUserHandle for the encoding contract.
func encodeUserHandle(userID int64) []byte {
	return passkey.EncodeUserHandle(userID)
}

// decodeUserHandle reverses encodeUserHandle, returning the Grafana user ID carried by a WebAuthn
// assertion's user handle. It errors if the handle is not exactly userHandleLen bytes.
func decodeUserHandle(b []byte) (int64, error) {
	if len(b) != passkey.UserHandleLen {
		return 0, fmt.Errorf("invalid user handle length: got %d bytes, want %d", len(b), passkey.UserHandleLen)
	}
	return int64(binary.BigEndian.Uint64(b)), nil
}
