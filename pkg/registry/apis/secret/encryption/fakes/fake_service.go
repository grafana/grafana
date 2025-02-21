package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

type FakeEncryptionService struct{}

func NewFakeEncryptionService() FakeEncryptionService {
	return FakeEncryptionService{}
}

func (f FakeEncryptionService) Encrypt(_ context.Context, namespace string, payload []byte, _ encryption.EncryptionOptions) ([]byte, error) {
	return payload, nil
}
func (f FakeEncryptionService) Decrypt(_ context.Context, namespace string, payload []byte) ([]byte, error) {
	return payload, nil
}
func (f FakeEncryptionService) EncryptJsonData(_ context.Context, kv map[string]string, _ encryption.EncryptionOptions) (map[string][]byte, error) {
	result := make(map[string][]byte, len(kv))
	for key, value := range kv {
		result[key] = []byte(value)
	}
	return result, nil
}

func (f FakeEncryptionService) DecryptJsonData(_ context.Context, sjd map[string][]byte) (map[string]string, error) {
	result := make(map[string]string, len(sjd))
	for key, value := range sjd {
		result[key] = string(value)
	}
	return result, nil
}
func (f FakeEncryptionService) GetDecryptedValue(_ context.Context, sjd map[string][]byte, key, fallback string) string {
	if value, ok := sjd[key]; ok {
		return string(value)
	}
	return fallback
}

func (f FakeEncryptionService) RotateDataKeys(_ context.Context, namespace string) error {
	return nil
}

func (f FakeEncryptionService) ReEncryptDataKeys(_ context.Context, namespace string) error {
	return nil
}

func (f FakeEncryptionService) CurrentProviderID() string {
	return "fakeProvider"
}

func (f FakeEncryptionService) GetProviders() map[string]encryption.Provider {
	return make(map[string]encryption.Provider)
}

func (f FakeEncryptionService) RegisterProvider(_ string, _ encryption.Provider) {}
