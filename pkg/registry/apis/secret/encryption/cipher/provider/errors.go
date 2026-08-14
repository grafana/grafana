package provider

import "errors"

// ErrPayloadTooShort is returned when the payload is too short to be decrypted.
// In some situations, the error may instead be io.ErrUnexpectedEOF or a cipher-specific error.
var ErrPayloadTooShort = errors.New("payload too short")
