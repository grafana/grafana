package gpg

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/fsutil"
)

// LoadGPGKeys loads GPG key pair and password from the environment and writes them to corresponding files.
//
// The passed config's GPG fields also get updated. Make sure to call RemoveGPGFiles at application exit.
func LoadGPGKeys(cfg *config.Config) error {
	var err error
	cfg.GPGPrivateKey, err = fsutil.CreateTempFile("priv.key")
	if err != nil {
		return err
	}
	cfg.GPGPublicKey, err = fsutil.CreateTempFile("pub.key")
	if err != nil {
		return err
	}
	cfg.GPGPassPath, err = fsutil.CreateTempFile("")
	if err != nil {
		return err
	}

	gpgPrivKey := os.Getenv("GPG_PRIV_KEY")
	if gpgPrivKey == "" {
		return fmt.Errorf("$GPG_PRIV_KEY must be defined")
	}
	gpgPubKey := os.Getenv("GPG_PUB_KEY")
	if gpgPubKey == "" {
		return fmt.Errorf("$GPG_PUB_KEY must be defined")
	}
	gpgPass := os.Getenv("GPG_KEY_PASSWORD")
	if gpgPass == "" {
		return fmt.Errorf("$GPG_KEY_PASSWORD must be defined")
	}

	gpgPrivKeyB, err := base64.StdEncoding.DecodeString(gpgPrivKey)
	if err != nil {
		return fmt.Errorf("couldn't decode $GPG_PRIV_KEY: %w", err)
	}
	gpgPubKeyB, err := base64.StdEncoding.DecodeString(gpgPubKey)
	if err != nil {
		return fmt.Errorf("couldn't decode $GPG_PUB_KEY: %w", err)
	}

	if err := os.WriteFile(cfg.GPGPrivateKey, append(gpgPrivKeyB, '\n'), 0400); err != nil {
		return fmt.Errorf("failed to write GPG private key file: %w", err)
	}
	if err := os.WriteFile(cfg.GPGPublicKey, append(gpgPubKeyB, '\n'), 0400); err != nil {
		return fmt.Errorf("failed to write GPG public key file: %w", err)
	}
	if err := os.WriteFile(cfg.GPGPassPath, []byte(gpgPass+"\n"), 0400); err != nil {
		return fmt.Errorf("failed to write GPG password file: %w", err)
	}

	return nil
}

// RemoveGPGFiles removes configured GPG files.
func RemoveGPGFiles(cfg config.Config) {
	for _, fpath := range []string{cfg.GPGPrivateKey, cfg.GPGPublicKey, cfg.GPGPassPath} {
		if err := os.Remove(fpath); err != nil {
			log.Printf("failed to remove %q", fpath)
		}
	}
}
