package gpg

import (
	"context"
	"fmt"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

func VerifySignature(ctx context.Context, d *dagger.Client, file *dagger.File, pubKey, privKey, passphrase string) error {
	container := Signer(d, pubKey, privKey, passphrase).
		WithFile("/src/package.rpm", file).
		WithExec([]string{"/bin/sh", "-c", "rpm --checksig /src/package.rpm"})

	if _, err := containers.ExitError(ctx, container); err != nil {
		return fmt.Errorf("failed to validate gpg signature for rpm package: %w", err)
	}
	return nil
}
