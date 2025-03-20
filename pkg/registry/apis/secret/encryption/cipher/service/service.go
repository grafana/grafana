package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	encryptionprovider "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/provider"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	encryptionAlgorithmDelimiter = '*'
)

// Service must not be used for cipher.
// Use secrets.Service implementing envelope encryption instead.
type Service struct {
	tracer tracing.Tracer
	log    log.Logger

	cfg          *setting.Cfg
	usageMetrics usagestats.Service

	ciphers   map[string]cipher.Encrypter
	deciphers map[string]cipher.Decrypter
}

func NewEncryptionService(
	tracer tracing.Tracer,
	usageMetrics usagestats.Service,
	cfg *setting.Cfg,
) (*Service, error) {
	if cfg.SecretsManagement.SecretKey == "" {
		return nil, fmt.Errorf("`[secrets_manager]secret_key` is not set")
	}

	if cfg.SecretsManagement.Encryption.Algorithm == "" {
		return nil, fmt.Errorf("`[secrets_manager.encryption]algorithm` is not set")
	}

	s := &Service{
		tracer: tracer,
		log:    log.New("encryption"),

		ciphers:   encryptionprovider.ProvideCiphers(),
		deciphers: encryptionprovider.ProvideDeciphers(),

		usageMetrics: usageMetrics,
		cfg:          cfg,
	}

	algorithm := s.cfg.SecretsManagement.Encryption.Algorithm

	if err := s.checkEncryptionAlgorithm(algorithm); err != nil {
		return nil, err
	}

	s.registerUsageMetrics()

	return s, nil
}

func (s *Service) checkEncryptionAlgorithm(algorithm string) error {
	var err error
	defer func() {
		if err != nil {
			s.log.Error("Wrong security encryption configuration", "algorithm", algorithm, "error", err)
		}
	}()

	if _, ok := s.ciphers[algorithm]; !ok {
		err = fmt.Errorf("no cipher registered for encryption algorithm '%s'", algorithm)
		return err
	}

	if _, ok := s.deciphers[algorithm]; !ok {
		err = fmt.Errorf("no decipher registered for encryption algorithm '%s'", algorithm)
		return err
	}

	return nil
}

func (s *Service) registerUsageMetrics() {
	s.usageMetrics.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		algorithm := s.cfg.SecretsManagement.Encryption.Algorithm

		return map[string]any{
			fmt.Sprintf("stats.%s.encryption.cipher.%s.count", encryption.UsageInsightsPrefix, algorithm): 1,
		}, nil
	})
}

func (s *Service) Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "cipher.service.Decrypt")
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

	decipher, ok := s.deciphers[algorithm]
	if !ok {
		err = fmt.Errorf("no decipher available for algorithm '%s'", algorithm)
		return nil, err
	}

	span.SetAttributes(attribute.String("cipher.algorithm", algorithm))

	var decrypted []byte
	decrypted, err = decipher.Decrypt(ctx, toDecrypt, secret)

	return decrypted, err
}

func (s *Service) deriveEncryptionAlgorithm(payload []byte) (string, []byte, error) {
	if len(payload) == 0 {
		return "", nil, fmt.Errorf("unable to derive encryption algorithm")
	}

	if payload[0] != encryptionAlgorithmDelimiter {
		return cipher.AesCfb, payload, nil // backwards compatibility
	}

	payload = payload[1:]
	algorithmDelimiterIdx := bytes.Index(payload, []byte{encryptionAlgorithmDelimiter})
	if algorithmDelimiterIdx == -1 {
		return cipher.AesCfb, payload, nil // backwards compatibility
	}

	algorithmB64 := payload[:algorithmDelimiterIdx]
	payload = payload[algorithmDelimiterIdx+1:]

	algorithm := make([]byte, base64.RawStdEncoding.DecodedLen(len(algorithmB64)))

	_, err := base64.RawStdEncoding.Decode(algorithm, algorithmB64)
	if err != nil {
		return "", nil, err
	}

	return string(algorithm), payload, nil
}

func (s *Service) Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "cipher.service.Encrypt")
	defer span.End()

	var err error
	defer func() {
		if err != nil {
			s.log.Error("Encryption failed", "error", err)
		}
	}()

	algorithm := s.cfg.SecretsManagement.Encryption.Algorithm

	cipher, ok := s.ciphers[algorithm]
	if !ok {
		err = fmt.Errorf("no cipher available for algorithm '%s'", algorithm)
		return nil, err
	}

	span.SetAttributes(attribute.String("cipher.algorithm", algorithm))

	var encrypted []byte
	encrypted, err = cipher.Encrypt(ctx, payload, secret)

	prefix := make([]byte, base64.RawStdEncoding.EncodedLen(len([]byte(algorithm)))+2)
	base64.RawStdEncoding.Encode(prefix[1:], []byte(algorithm))
	prefix[0] = encryptionAlgorithmDelimiter
	prefix[len(prefix)-1] = encryptionAlgorithmDelimiter

	ciphertext := make([]byte, len(prefix)+len(encrypted))
	copy(ciphertext, prefix)
	copy(ciphertext[len(prefix):], encrypted)

	return ciphertext, nil
}
