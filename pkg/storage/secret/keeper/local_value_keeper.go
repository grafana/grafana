package keeper

import (
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/vaultstorage"
)

var _ SecretKeeperService = (*LocalValueKeeper)(nil)

// LocalValueKeeper, the encryption is done by another service here and the vault storage is a SQL table.
type LocalValueKeeper struct {
	encryption encryption.EncryptionService
	store      vaultstorage.VaultStorageService
}

func NewLocalValueKeeper(encryption encryption.EncryptionService, store vaultstorage.VaultStorageService) *LocalValueKeeper {
	return &LocalValueKeeper{encryption, store}
}

func (k *LocalValueKeeper) Encryption() encryption.EncryptionService {
	return k.encryption
}

func (k *LocalValueKeeper) VaultStorage() vaultstorage.VaultStorageService {
	return k.store
}
