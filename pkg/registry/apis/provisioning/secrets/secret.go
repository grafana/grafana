package secrets

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// FIXME: this is a temporary service/package until we can make use of
// the new secrets service in app platform
type Service struct {
	encryptionKey []byte
}

func NewService(encryptionKey string) *Service {
	return &Service{encryptionKey: []byte(encryptionKey)}
}

func (s *Service) Encrypt(ctx context.Context, data string) (string, error) {
	h := hmac.New(sha256.New, s.encryptionKey)
	h.Write([]byte(data))
	hashed := h.Sum(nil)

	return hex.EncodeToString(hashed), nil
}
