package provider

import (
	"context"

	"github.com/grafana/grafana/pkg/services/encryption"
)

type aesCipher struct {
	algorithm string
}

func (c aesCipher) Encrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {

	switch c.algorithm {
	case encryption.AesGcm:
		return gCMEncrypter(payload, secret)
	default:
		return cFBEncrypter(payload, secret)
	}
}
