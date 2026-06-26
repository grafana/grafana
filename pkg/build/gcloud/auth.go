package gcloud

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
)

func GetDecodedKey() ([]byte, error) {
	gcpKey := strings.TrimSpace(os.Getenv("GCP_KEY"))
	if gcpKey == "" {
		return nil, fmt.Errorf("the environment variable GCP_KEY must be set")
	}

	gcpKeyB, err := base64.StdEncoding.DecodeString(gcpKey)
	if err != nil {
		// key is not always base64 encoded
		validKey := []byte(gcpKey)
		if json.Valid(validKey) {
			return validKey, nil
		}
		return nil, fmt.Errorf("error decoding the gcp_key, err: %q", err)
	}

	return gcpKeyB, nil
}

func ActivateServiceAccount() error {
	byteKey, err := GetDecodedKey()
	if err != nil {
		return err
	}

	f, err := os.CreateTemp("", "*.json")
	if err != nil {
		return err
	}
	defer func() {
		if err := os.Remove(f.Name()); err != nil {
			log.Printf("error removing %s: %s", f.Name(), err)
		}
	}()

	defer func() {
		if err := f.Close(); err != nil {
			log.Println("error closing file:", err)
		}
	}()

	if _, err := f.Write(byteKey); err != nil {
		return fmt.Errorf("failed to write GCP key file: %w", err)
	}
	keyArg := fmt.Sprintf("--key-file=%s", f.Name())
	//nolint:gosec
	cmd := exec.Command("gcloud", "auth", "activate-service-account", keyArg)

	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to sign into GCP: %w\n%s", err, output)
	}
	return nil
}
