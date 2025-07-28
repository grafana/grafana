package gpg

import (
	"dagger.io/dagger"
)

const RPMMacros = `
%_signature gpg
%_gpg_path /root/.gnupg
%_gpg_name Grafana
%_gpgbin /usr/bin/gpg2
%__gpg_sign_cmd %{__gpg} gpg \
	--batch --yes --no-armor --pinentry-mode loopback \
	--passphrase-file /root/.rpmdb/passkeys/grafana.key \
	--no-secmem-warning -u "%{_gpg_name}" -sbo %{__signature_filename} \
	%{?_gpg_digest_algo:--digest-algo %{_gpg_digest_algo}} %{__plaintext_filename}
`

type GPGOpts struct {
	GPGPrivateKey string
	GPGPublicKey  string
	GPGPassphrase string
}

func Signer(d *dagger.Client, pubkey, privkey, passphrase string) *dagger.Container {
	var (
		gpgPublicKeySecret  = d.SetSecret("gpg-public-key", pubkey)
		gpgPrivateKeySecret = d.SetSecret("gpg-private-key", privkey)
		gpgPassphraseSecret = d.SetSecret("gpg-passphrase", passphrase)
	)

	return d.Container().From("debian:stable").
		WithExec([]string{"apt-get", "update"}).
		WithExec([]string{"apt-get", "install", "-yq", "rpm", "gnupg2", "file"}).
		WithMountedSecret("/root/.rpmdb/privkeys/grafana.key", gpgPrivateKeySecret).
		WithMountedSecret("/root/.rpmdb/pubkeys/grafana.key", gpgPublicKeySecret).
		WithMountedSecret("/root/.rpmdb/passkeys/grafana.key", gpgPassphraseSecret).
		WithExec([]string{"/bin/sh", "-c", `
			echo "DEBUG: Mounted RPM Pub Key file detected to be: $(file "/root/.rpmdb/pubkeys/grafana.key")";
			echo "DEBUG: Mounted RPM Pub Key file has $(wc -c "/root/.rpmdb/pubkeys/grafana.key") bytes";
			echo "DEBUG: Mounted RPM Pub Key file has $(wc -l "/root/.rpmdb/pubkeys/grafana.key") lines";
			if grep -q "PUBLIC KEY" "/root/.rpmdb/pubkeys/grafana.key"; then
				cp "/root/.rpmdb/pubkeys/grafana.key" "/tmp/grafana.key";
			else
				gpg --enarmor "/root/.rpmdb/pubkeys/grafana.key" > "/tmp/grafana.key";
			fi;
			if [ "$(tail -n 1 "/tmp/grafana.key" | wc -l)" = 0 ]; then
				echo >> "/tmp/grafana.key";
			fi;
			echo "DEBUG: Final RPM Pub Key file has $(wc -c "/tmp/grafana.key") bytes";
			echo "DEBUG: Final RPM Pub Key file has $(wc -l "/tmp/grafana.key") lines";
		`}).
		WithExec([]string{"rpm", "--import", "/tmp/grafana.key"}).
		WithNewFile("/root/.rpmmacros", RPMMacros, dagger.ContainerWithNewFileOpts{
			Permissions: 0400,
		}).
		WithExec([]string{"gpg", "--batch", "--yes", "--no-tty", "--allow-secret-key-import", "--import", "/root/.rpmdb/privkeys/grafana.key"})
}

func Sign(d *dagger.Client, file *dagger.File, opts GPGOpts) *dagger.File {
	return Signer(d, opts.GPGPublicKey, opts.GPGPrivateKey, opts.GPGPassphrase).
		WithMountedFile("/src/package.rpm", file).
		WithExec([]string{"rpm", "--addsign", "/src/package.rpm"}).
		File("/src/package.rpm")
}
