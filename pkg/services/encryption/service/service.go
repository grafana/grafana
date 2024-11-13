package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	encryptionAlgorithmDelimiter = '*'

	securitySection            = "security.encryption"
	encryptionAlgorithmKey     = "algorithm"
	defaultEncryptionAlgorithm = encryption.AesCfb
)

// Service must not be used for encryption.
// Use secrets.Service implementing envelope encryption instead.
type Service struct {
	tracer tracing.Tracer
	log    log.Logger

	cfg          *setting.Cfg
	usageMetrics usagestats.Service

	ciphers   map[string]encryption.Cipher
	deciphers map[string]encryption.Decipher
}

func ProvideEncryptionService(
	tracer tracing.Tracer,
	provider encryption.Provider,
	usageMetrics usagestats.Service,
	cfg *setting.Cfg,
) (*Service, error) {
	s := &Service{
		tracer: tracer,
		log:    log.New("encryption"),

		ciphers:   provider.ProvideCiphers(),
		deciphers: provider.ProvideDeciphers(),

		usageMetrics: usageMetrics,
		cfg:          cfg,
	}

	algorithm := s.cfg.SectionWithEnvOverrides(securitySection).Key(encryptionAlgorithmKey).
		MustString(defaultEncryptionAlgorithm)

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
		err = errors.New("no cipher registered for encryption algorithm configured")
		return err
	}

	if _, ok := s.deciphers[algorithm]; !ok {
		err = errors.New("no cipher registered for encryption algorithm configured")
		return err
	}

	return nil
}

func (s *Service) registerUsageMetrics() {
	s.usageMetrics.RegisterMetricsFunc(func(context.Context) (map[string]any, error) {
		algorithm := s.cfg.SectionWithEnvOverrides(securitySection).Key(encryptionAlgorithmKey).
			MustString(defaultEncryptionAlgorithm)

		return map[string]any{
			fmt.Sprintf("stats.encryption.%s.count", algorithm): 1,
		}, nil
	})
}

func (s *Service) Decrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "encryption.service.Decrypt")
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

	span.SetAttributes(attribute.String("encryption.algorithm", algorithm))

	var decrypted []byte
	decrypted, err = decipher.Decrypt(ctx, toDecrypt, secret)

	return decrypted, err
}

func (s *Service) deriveEncryptionAlgorithm(payload []byte) (string, []byte, error) {
	if len(payload) == 0 {
		return "", nil, fmt.Errorf("unable to derive encryption algorithm")
	}

	if payload[0] != encryptionAlgorithmDelimiter {
		return encryption.AesCfb, payload, nil // backwards compatibility
	}

	payload = payload[1:]
	algorithmDelimiterIdx := bytes.Index(payload, []byte{encryptionAlgorithmDelimiter})
	if algorithmDelimiterIdx == -1 {
		return encryption.AesCfb, payload, nil // backwards compatibility
	}

	algorithmB64 := payload[:algorithmDelimiterIdx]
	payload = payload[algorithmDelimiterIdx+1:]

	algorithm := make([]byte, base64.RawStdEncoding.DecodedLen(len(algorithmB64)))

	_, err := base64.RawStdEncoding.Decode(algorithm, algorithmB64)
	if err != nil {
		return "", nil, err
	}

	// For historical reasons, I guess a bug introduced in the past,
	// the algorithm metadata could be missing at this point.
	//
	// Until now, it hasn't failed because we're used to fall back
	// to the default encryption algorithm.
	//
	// Therefore, we want to keep doing the same to be able to
	// decrypt legacy secrets.
	if string(algorithm) == "" {
		s.log.Warn("Encryption algorithm derivation found an empty string", "error", err)
		return encryption.AesCfb, payload, nil
	}

	return string(algorithm), payload, nil
}

func (s *Service) Encrypt(ctx context.Context, payload []byte, secret string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "encryption.service.Encrypt")
	defer span.End()

	var err error
	defer func() {
		if err != nil {
			s.log.Error("Encryption failed", "error", err)
		}
	}()

	algorithm := s.cfg.SectionWithEnvOverrides(securitySection).Key(encryptionAlgorithmKey).
		MustString(defaultEncryptionAlgorithm)

	cipher, ok := s.ciphers[algorithm]
	if !ok {
		err = fmt.Errorf("no cipher available for algorithm '%s'", algorithm)
		return nil, err
	}

	span.SetAttributes(attribute.String("encryption.algorithm", algorithm))

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

func (s *Service) EncryptJsonData(ctx context.Context, kv map[string]string, secret string) (map[string][]byte, error) {
	encrypted := make(map[string][]byte)
	for key, value := range kv {
		encryptedData, err := s.Encrypt(ctx, []byte(value), secret)
		if err != nil {
			return nil, err
		}

		encrypted[key] = encryptedData
	}
	return encrypted, nil
}

func (s *Service) DecryptJsonData(ctx context.Context, sjd map[string][]byte, secret string) (map[string]string, error) {
	decrypted := make(map[string]string)
	for key, data := range sjd {
		decryptedData, err := s.Decrypt(ctx, data, secret)
		if err != nil {
			return nil, err
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted, nil
}

func (s *Service) GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key, fallback, secret string) string {
	if value, ok := sjd[key]; ok {
		decryptedData, err := s.Decrypt(ctx, value, secret)
		if err != nil {
			return fallback
		}

		return string(decryptedData)
	}

	return fallback
}
