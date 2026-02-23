package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/provider"
)

const (
	encryptionAlgorithmDelimiter = '*'
)

type cipherService struct {
	tracer trace.Tracer
	log    log.Logger

	usageMetrics usagestats.Service

	cipher    cipher.Encrypter
	decipher  cipher.Decrypter
	algorithm string
}

// ProvideAESGCMCipherService provides an AES-GCM cipher for encryption and decryption.
// It should not be used to encrypt payloads directly, as it is intended to encrypt data keys for envelope encryption.
func ProvideAESGCMCipherService(
	tracer trace.Tracer,
	usageMetrics usagestats.Service,
) (cipher.Cipher, error) {
	s := &cipherService{
		tracer: tracer,
		log:    log.New("encryption"),

		// Use the AES-GCM cipher for encryption and decryption.
		// This is the only cipher supported by the secrets management system.
		cipher:    provider.NewAesGcmCipher(),
		decipher:  provider.NewAesGcmCipher(),
		algorithm: provider.AesGcm,

		usageMetrics: usageMetrics,
	}

	s.registerUsageMetrics()

	return s, nil
}

func (s *cipherService) registerUsageMetrics() {
	s.usageMetrics.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		return map[string]any{
			fmt.Sprintf("stats.%s.encryption.cipher.%s.count", encryption.UsageInsightsPrefix, s.algorithm): 1,
		}, nil
	})
}

func (s *cipherService) Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "CipherService.Decrypt")
	defer span.End()

	var err error
	defer func() {
		if err != nil {
			s.log.FromContext(ctx).Error("Decryption failed", "error", err)
		}
	}()

	var (
		algorithm string
		toDecrypt []byte
	)
	algorithm, toDecrypt, err = s.deriveEncryptionAlgorithm(payload)
	if err != nil {
		return nil, err
	}

	span.SetAttributes(attribute.String("cipher.algorithm", algorithm))

	var decrypted []byte
	decrypted, err = s.decipher.Decrypt(ctx, toDecrypt, secret)

	return decrypted, err
}

func (s *cipherService) deriveEncryptionAlgorithm(payload []byte) (string, []byte, error) {
	if len(payload) == 0 {
		return "", nil, fmt.Errorf("unable to derive encryption algorithm")
	}

	payload = payload[1:]
	algorithmDelimiterIdx := bytes.Index(payload, []byte{encryptionAlgorithmDelimiter})

	algorithmB64 := payload[:algorithmDelimiterIdx]
	payload = payload[algorithmDelimiterIdx+1:]

	algorithm := make([]byte, base64.RawStdEncoding.DecodedLen(len(algorithmB64)))

	_, err := base64.RawStdEncoding.Decode(algorithm, algorithmB64)
	if err != nil {
		return "", nil, err
	}

	return string(algorithm), payload, nil
}

func (s *cipherService) Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "CipherService.Encrypt")
	defer span.End()

	var err error
	defer func() {
		if err != nil {
			s.log.Error("Encryption failed", "error", err)
		}
	}()

	span.SetAttributes(attribute.String("cipher.algorithm", s.algorithm))

	var encrypted []byte
	encrypted, err = s.cipher.Encrypt(ctx, payload, secret)

	prefix := make([]byte, base64.RawStdEncoding.EncodedLen(len([]byte(s.algorithm)))+2)
	base64.RawStdEncoding.Encode(prefix[1:], []byte(s.algorithm))
	prefix[0] = encryptionAlgorithmDelimiter
	prefix[len(prefix)-1] = encryptionAlgorithmDelimiter

	ciphertext := make([]byte, len(prefix)+len(encrypted))
	copy(ciphertext, prefix)
	copy(ciphertext[len(prefix):], encrypted)

	return ciphertext, nil
}
