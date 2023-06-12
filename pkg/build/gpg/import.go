package gpg

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/infra/fs"
)

// writeRpmMacros writes ~/.rpmmacros.
func writeRpmMacros(homeDir, gpgPassPath string) error {
	fpath := filepath.Join(homeDir, ".rpmmacros")
	content := fmt.Sprintf(`%%_signature gpg
%%_gpg_path %s/.gnupg
%%_gpg_name Grafana
%%_gpgbin /usr/bin/gpg
%%__gpg_sign_cmd %%{__gpg} gpg --batch --yes --pinentry-mode loopback --no-armor --passphrase-file %s --no-secmem-warning -u "%%{_gpg_name}" -sbo %%{__signature_filename} %%{__plaintext_filename}
`, homeDir, gpgPassPath)
	//nolint:gosec
	if err := os.WriteFile(fpath, []byte(content), 0600); err != nil {
		return fmt.Errorf("failed to write %q: %w", fpath, err)
	}

	return nil
}

// Import imports the GPG package signing key.
// ~/.rpmmacros also gets written.
func Import(cfg config.Config) error {
	exists, err := fs.Exists(cfg.GPGPrivateKey)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("GPG private key file doesn't exist: %q", cfg.GPGPrivateKey)
	}

	log.Printf("Importing GPG key %q...", cfg.GPGPrivateKey)
	// nolint:gosec
	cmd := exec.Command("gpg", "--batch", "--yes", "--no-tty", "--allow-secret-key-import", "--import",
		cfg.GPGPrivateKey)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to import private key: %s", output)
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	if err := writeRpmMacros(homeDir, cfg.GPGPassPath); err != nil {
		return err
	}

	pubKeysPath := filepath.Join(homeDir, ".rpmdb", "pubkeys")
	if err := os.MkdirAll(pubKeysPath, 0700); err != nil {
		return fmt.Errorf("failed to make %s: %w", pubKeysPath, err)
	}
	gpgPub, err := os.ReadFile(cfg.GPGPublicKey)
	if err != nil {
		return err
	}
	//nolint:gosec
	if err := os.WriteFile(filepath.Join(homeDir, ".rpmdb", "pubkeys", "grafana.key"), gpgPub, 0400); err != nil {
		return fmt.Errorf("failed to write pub key to ~/.rpmdb: %w", err)
	}

	return nil
}
