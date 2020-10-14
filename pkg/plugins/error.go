package plugins

import "fmt"

const (
	signatureMissing ErrorCode = iota
	signatureModified
	signatureInvalid
)

type ErrorCode int

func (e ErrorCode) String() string {
	switch e {
	case signatureMissing:
		return "signatureMissing"
	case signatureModified:
		return "signatureModified"
	case signatureInvalid:
		return "signatureInvalid"
	default:
		panic(fmt.Sprintf("Unrecognized error code %d", e))
	}
}

type PluginError struct {
	ErrorCode
}

type PluginErrors struct {
	PluginErrors []PluginError
}
