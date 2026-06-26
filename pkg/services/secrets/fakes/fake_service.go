package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/services/secrets"
)

type FakeSecretsService struct{}

func NewFakeSecretsService() FakeSecretsService {
	return FakeSecretsService{}
}

func (f FakeSecretsService) Encrypt(_ context.Context, payload []byte, _ secrets.EncryptionOptions) ([]byte, error) {
	return payload, nil
}
func (f FakeSecretsService) Decrypt(_ context.Context, payload []byte) ([]byte, error) {
	return payload, nil
}
func (f FakeSecretsService) EncryptJsonData(_ context.Context, kv map[string]string, _ secrets.EncryptionOptions) (map[string][]byte, error) {
	result := make(map[string][]byte, len(kv))
	for key, value := range kv {
		result[key] = []byte(value)
	}
	return result, nil
}

func (f FakeSecretsService) DecryptJsonData(_ context.Context, sjd map[string][]byte) (map[string]string, error) {
	result := make(map[string]string, len(sjd))
	for key, value := range sjd {
		result[key] = string(value)
	}
	return result, nil
}
func (f FakeSecretsService) GetDecryptedValue(_ context.Context, sjd map[string][]byte, key, fallback string) string {
	if value, ok := sjd[key]; ok {
		return string(value)
	}
	return fallback
}

func (f FakeSecretsService) RotateDataKeys(_ context.Context) error {
	return nil
}

func (f FakeSecretsService) ReEncryptDataKeys(_ context.Context) error {
	return nil
}

func (f FakeSecretsService) CurrentProviderID() string {
	return "fakeProvider"
}

func (f FakeSecretsService) GetProviders() map[string]secrets.Provider {
	return make(map[string]secrets.Provider)
}

func (f FakeSecretsService) RegisterProvider(_ string, _ secrets.Provider) {}
