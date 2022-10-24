package jwt

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"gopkg.in/square/go-jose.v2/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideVerificationService(cfg *setting.Cfg) (*VerificationService, error) {
	s := newVerificationService(cfg)
	return s, nil
}

func newVerificationService(cfg *setting.Cfg) *VerificationService {
	return &VerificationService{
		Cfg: cfg,
		log: log.New("auth.jwt.verification"),
	}
}

type VerificationService struct {
	Cfg *setting.Cfg
	log log.Logger
}

func (s *VerificationService) Verify(ctx context.Context, keySet keySet, expectedClaims jwt.Expected, additionalClaims map[string]interface{}, strToken string) (models.JWTClaims, error) {
	s.log.Debug("Parsing JSON Web Token")

	strToken = sanitizeJWT(strToken)
	token, err := jwt.ParseSigned(strToken)
	if err != nil {
		return nil, err
	}

	keys, err := keySet.Key(ctx, token.Headers[0].KeyID)
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return nil, errors.New("key ID not found in configured key sets")
	}

	s.log.Debug("Trying to verify JSON Web Token using a key")
	var claims models.JWTClaims
	for _, key := range keys {
		if err = token.Claims(key, &claims); err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}

	s.log.Debug("Validating JSON Web Token claims")

	if err = s.validateExpectedClaims(expectedClaims, claims); err != nil {
		return nil, err
	}

	if err = s.validateAdditionalClaims(additionalClaims, claims); err != nil {
		return nil, err
	}

	return claims, nil
}

func (s *VerificationService) validateExpectedClaims(expectRegistered jwt.Expected, claims models.JWTClaims) error {
	var registeredClaims jwt.Claims
	for key, value := range claims {
		switch key {
		case "iss":
			if stringValue, ok := value.(string); ok {
				registeredClaims.Issuer = stringValue
			} else {
				return fmt.Errorf("%q claim has invalid type %T, string expected", key, value)
			}
		case "sub":
			if stringValue, ok := value.(string); ok {
				registeredClaims.Subject = stringValue
			} else {
				return fmt.Errorf("%q claim has invalid type %T, string expected", key, value)
			}
		case "aud":
			switch value := value.(type) {
			case []interface{}:
				for _, val := range value {
					if v, ok := val.(string); ok {
						registeredClaims.Audience = append(registeredClaims.Audience, v)
					} else {
						return fmt.Errorf("%q claim contains value with invalid type %T, string expected", key, val)
					}
				}
			case string:
				registeredClaims.Audience = []string{value}
			default:
				return fmt.Errorf("%q claim has invalid type %T, array or string expected", key, value)
			}
		case "exp":
			if value == nil {
				continue
			}
			if floatValue, ok := value.(float64); ok {
				out := jwt.NumericDate(floatValue)
				registeredClaims.Expiry = &out
			} else {
				return fmt.Errorf("%q claim has invalid type %T, number expected", key, value)
			}
		case "nbf":
			if value == nil {
				continue
			}
			if floatValue, ok := value.(float64); ok {
				out := jwt.NumericDate(floatValue)
				registeredClaims.NotBefore = &out
			} else {
				return fmt.Errorf("%q claim has invalid type %T, number expected", key, value)
			}
		case "iat":
			if value == nil {
				continue
			}
			if floatValue, ok := value.(float64); ok {
				out := jwt.NumericDate(floatValue)
				registeredClaims.IssuedAt = &out
			} else {
				return fmt.Errorf("%q claim has invalid type %T, number expected", key, value)
			}
		}
	}

	expectRegistered.Time = time.Now()
	if err := registeredClaims.Validate(expectRegistered); err != nil {
		return err
	}

	return nil
}

func (s *VerificationService) validateAdditionalClaims(expected map[string]interface{}, claims models.JWTClaims) error {
	for key, expected := range expected {
		value, ok := claims[key]
		if !ok {
			return fmt.Errorf("%q claim is missing", key)
		}
		if !reflect.DeepEqual(expected, value) {
			return fmt.Errorf("%q claim mismatch", key)
		}
	}

	return nil
}

// Sanitize JWT base64 strings to remove paddings everywhere
func sanitizeJWT(jwtToken string) string {
	// JWT can be compact, JSON flatened or JSON general
	// In every cases, parts are base64 strings without padding
	// The padding char (=) should never interfer with data
	return strings.ReplaceAll(jwtToken, string(base64.StdPadding), "")
}
