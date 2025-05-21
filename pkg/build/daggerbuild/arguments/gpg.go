package arguments

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

var (
	GPGPublicKeyFlag = &cli.StringFlag{
		Name:    "gpg-public-key-base64",
		Usage:   "Provides a public key encoded in base64 for GPG signing",
		EnvVars: []string{"GPG_PUBLIC_KEY"},
	}
	GPGPrivateKeyFlag = &cli.StringFlag{
		Name:    "gpg-private-key-base64",
		Usage:   "Provides a private key encoded in base64 for GPG signing",
		EnvVars: []string{"GPG_PRIVATE_KEY"},
	}
	GPGPassphraseFlag = &cli.StringFlag{
		Name:    "gpg-passphrase",
		Usage:   "Provides a private key passphrase encoded in base64 for GPG signing",
		EnvVars: []string{"GPG_PASSPHRASE"},
	}

	GPGPublicKey  = pipeline.NewStringFlagArgument(GPGPublicKeyFlag)
	GPGPrivateKey = pipeline.NewStringFlagArgument(GPGPrivateKeyFlag)
	GPGPassphrase = pipeline.NewStringFlagArgument(GPGPassphraseFlag)
)
