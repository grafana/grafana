package git

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestSigningOption(t *testing.T) {
	tests := []struct {
		name          string
		gitConfig     RepositoryConfig
		expectedError string
	}{
		{
			name: "ssh",
			gitConfig: RepositoryConfig{
				SigningMethod:    provisioning.SSHSigningMethod,
				CommitSigningKey: "ssh-key",
			},
		},
		{
			name: "gpg",
			gitConfig: RepositoryConfig{
				SigningMethod:    provisioning.GPGSigningMethod,
				CommitSigningKey: "gpg-key",
			},
		},
		{
			name: "smime with certificate",
			gitConfig: RepositoryConfig{
				SigningMethod:    provisioning.SMIMESigningMethod,
				CommitSigningKey: "smime-key",
				SMIMECertificate: "smime-cert",
			},
		},
		{
			name: "smime missing certificate",
			gitConfig: RepositoryConfig{
				SigningMethod:    provisioning.SMIMESigningMethod,
				CommitSigningKey: "smime-key",
			},
			expectedError: "smime signing requires spec.commit.smimeCertificate",
		},
		{
			name: "unsupported method",
			gitConfig: RepositoryConfig{
				SigningMethod:    provisioning.SigningMethod("unknown"),
				CommitSigningKey: "key",
			},
			expectedError: `unsupported signing method "unknown"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opt, err := signingOption(tt.gitConfig)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.expectedError)
				require.Nil(t, opt)
			} else {
				require.NoError(t, err)
				require.NotNil(t, opt)
			}
		})
	}
}
