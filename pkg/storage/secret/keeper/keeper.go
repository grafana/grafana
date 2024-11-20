package keeper

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/vaultstorage"
)

// SecretKeeperService encapsulates two things:
// 1- A service that encrypts and decrypts data.
// 2- A service that stores and retrieves data, but this data is an encrypted value, which does not need to be encrypted in (1).
type SecretKeeperService interface {
	Encryption() encryption.EncryptionService
	VaultStorage() vaultstorage.VaultStorageService
}

// This is the list of remote keepers we support.
// e.g. for AWS:
// -  Encryption() fulfilled by AWS KMS.
// -  VaultStorage() fulfilled by AWS Secrets Manager.
type SecretKeeperRemoteProvider string

const (
	SecretKeeperRemoteProviderAWS = SecretKeeperRemoteProvider("aws")
)

func NewRemoteProvider(raw string) (SecretKeeperRemoteProvider, error) {
	if raw == "aws" {
		return SecretKeeperRemoteProviderAWS, nil
	}

	return "", fmt.Errorf("not found")
}
