package jwt

import (
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	"gopkg.in/square/go-jose.v2/jwt"

	"github.com/grafana/grafana/pkg/models"
)

func (s *AuthService) initClaimExpectations() error {
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

func (s *AuthService) validateClaims(claims models.JWTClaims) error {
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
