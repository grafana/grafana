package signature

import "fmt"

const (
	Internal Status = "internal" // core plugin, no signature
	Valid    Status = "valid"    // signed and accurate MANIFEST
	Invalid  Status = "invalid"  // invalid signature
	Modified Status = "modified" // valid signature, but content mismatch
	Unsigned Status = "unsigned" // no MANIFEST file

	signatureMissing  ErrorCode = "signatureMissing"
	signatureModified ErrorCode = "signatureModified"
	signatureInvalid  ErrorCode = "signatureInvalid"
)

type ErrorCode string

type Status string

func (ss Status) IsValid() bool {
	return ss == Valid
}

func (ss Status) IsInternal() bool {
	return ss == Internal
}

type Error struct {
	PluginID        string `json:"pluginId"`
	SignatureStatus Status `json:"status"`
}

func (e Error) Error() string {
	switch e.SignatureStatus {
	case Invalid:
		return fmt.Sprintf("plugin '%s' has an invalid signature", e.PluginID)
	case Modified:
		return fmt.Sprintf("plugin '%s' has an modified signature", e.PluginID)
	case Unsigned:
		return fmt.Sprintf("plugin '%s' has no signature", e.PluginID)
	case Internal, Valid:
		return ""
	}

	return fmt.Sprintf("plugin '%s' has an unknown signature state", e.PluginID)
}

func (e Error) AsErrorCode() ErrorCode {
	switch e.SignatureStatus {
	case Invalid:
		return signatureInvalid
	case Modified:
		return signatureModified
	case Unsigned:
		return signatureMissing
	case Internal, Valid:
		return ""
	}
	return ""
}
