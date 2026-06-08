package git

import (
	"fmt"

	"github.com/grafana/nanogit"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// SigningFormatFromSpec returns the commit signing format from the repository
// spec, or an empty format when no commit options are set.
func SigningFormatFromSpec(r *provisioning.Repository) provisioning.SigningFormat {
	if r.Spec.Commit != nil {
		return r.Spec.Commit.SigningFormat
	}
	return ""
}

// SMIMECertificateFromSpec returns the public S/MIME certificate from the
// repository spec, or an empty string when no commit options are set.
func SMIMECertificateFromSpec(r *provisioning.Repository) string {
	if r.Spec.Commit != nil {
		return r.Spec.Commit.SMIMECertificate
	}
	return ""
}

// signingOption returns the nanogit writer option that signs commits with the
// configured key. The format selects which signer is used; an empty format
// defaults to GPG.
func signingOption(cfg RepositoryConfig) (nanogit.WriterOption, error) {
	key := []byte(cfg.SigningKey)
	switch cfg.SigningFormat {
	case provisioning.SSHSigningFormat:
		return nanogit.WithSSHSigner(key), nil
	case provisioning.SMIMESigningFormat:
		return nanogit.WithSMIMESigner(key, []byte(cfg.SMIMECertificate)), nil
	case provisioning.GPGSigningFormat, "":
		return nanogit.WithGPGSigner(key), nil
	default:
		return nil, fmt.Errorf("unsupported signing format %q", cfg.SigningFormat)
	}
}
