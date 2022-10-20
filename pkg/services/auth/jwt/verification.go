package jwt

import (
	"context"
	"encoding/base64"
	"encoding/json"
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
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newVerificationService(cfg *setting.Cfg) *VerificationService {
	return &VerificationService{
		Cfg: cfg,
		log: log.New("auth.jwt.verification"),
	}
}

func (s *VerificationService) init() error {
	if err := s.initClaimExpectations(); err != nil {
		return err
	}

	return nil
}

type VerificationService struct {
	Cfg *setting.Cfg

	keySet           keySet
	log              log.Logger
	expect           map[string]interface{}
	expectRegistered jwt.Expected
}

// Sanitize JWT base64 strings to remove paddings everywhere
func sanitizeJWT(jwtToken string) string {
	// JWT can be compact, JSON flatened or JSON general
	// In every cases, parts are base64 strings without padding
	// The padding char (=) should never interfer with data
	return strings.ReplaceAll(jwtToken, string(base64.StdPadding), "")
}

func (s *VerificationService) KeySet(ks ...keySet) keySet {
	if len(ks) == 1 {
		s.keySet = ks[0]
	}
	return s.keySet
}

func (s *VerificationService) Verify(ctx context.Context, strToken string) (models.JWTClaims, error) {
	s.log.Debug("Parsing JSON Web Token")

	strToken = sanitizeJWT(strToken)
	token, err := jwt.ParseSigned(strToken)
	if err != nil {
		return nil, err
	}

	keys, err := s.keySet.Key(ctx, token.Headers[0].KeyID)
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

	if err = s.validateClaims(claims); err != nil {
		return nil, err
	}

	return claims, nil
}

func (s *VerificationService) initClaimExpectations() error {
	if err := json.Unmarshal([]byte(s.Cfg.JWTAuthExpectClaims), &s.expect); err != nil {
		return err
	}

	for key, value := range s.expect {
		switch key {
		case "iss":
			if stringValue, ok := value.(string); ok {
				s.expectRegistered.Issuer = stringValue
			} else {
				return fmt.Errorf("%q expectation has invalid type %T, string expected", key, value)
			}
			delete(s.expect, key)
		case "sub":
			if stringValue, ok := value.(string); ok {
				s.expectRegistered.Subject = stringValue
			} else {
				return fmt.Errorf("%q expectation has invalid type %T, string expected", key, value)
			}
			delete(s.expect, key)
		case "aud":
			switch value := value.(type) {
			case []interface{}:
				for _, val := range value {
					if v, ok := val.(string); ok {
						s.expectRegistered.Audience = append(s.expectRegistered.Audience, v)
					} else {
						return fmt.Errorf("%q expectation contains value with invalid type %T, string expected", key, val)
					}
				}
			case string:
				s.expectRegistered.Audience = []string{value}
			default:
				return fmt.Errorf("%q expectation has invalid type %T, array or string expected", key, value)
			}
			delete(s.expect, key)
		}
	}

	return nil
}

func (s *VerificationService) validateClaims(claims models.JWTClaims) error {
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

	expectRegistered := s.expectRegistered
	expectRegistered.Time = time.Now()
	if err := registeredClaims.Validate(expectRegistered); err != nil {
		return err
	}

	for key, expected := range s.expect {
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
