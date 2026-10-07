package git

import (
	"fmt"

	"github.com/grafana/nanogit"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func SigningMethodFromSpec(r *provisioning.Repository) provisioning.SigningMethod {
	if r.Spec.Commit != nil {
		return r.Spec.Commit.SigningMethod
	}
	return ""
}

func SMIMECertificateFromSpec(r *provisioning.Repository) string {
	if r.Spec.Commit != nil {
		return r.Spec.Commit.SMIMECertificate
	}
	return ""
}

func signingOption(cfg RepositoryConfig) (nanogit.WriterOption, error) {
	key := []byte(cfg.CommitSigningKey)
	switch cfg.SigningMethod {
	case provisioning.SSHSigningMethod:
		return nanogit.WithSSHSigner(key), nil
	case provisioning.SMIMESigningMethod:
		if cfg.SMIMECertificate == "" {
			return nil, fmt.Errorf("smime signing requires spec.commit.smimeCertificate")
		}
		return nanogit.WithSMIMESigner(key, []byte(cfg.SMIMECertificate)), nil
	case provisioning.GPGSigningMethod:
		return nanogit.WithGPGSigner(key), nil
	default:
		return nil, fmt.Errorf("unsupported signing method %q", cfg.SigningMethod)
	}
}
