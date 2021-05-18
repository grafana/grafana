package manager

import (
	"github.com/grafana/grafana/pkg/internal/plugins"
)

const (
	signatureMissing  plugins.ErrorCode = "signatureMissing"
	signatureModified plugins.ErrorCode = "signatureModified"
	signatureInvalid  plugins.ErrorCode = "signatureInvalid"
)
