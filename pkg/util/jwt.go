package util

import (
	"gopkg.in/square/go-jose.v2"

	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"

	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
)

type VerifyConfig struct {
	// "iss" claim
	ExpectedIssuer string
	// "sub" claim
	ExpectedSubject string
	// "aud" claim
	ExpectedAudience string
}

type keyHolder interface {
	getVerificationKeys(header jose.Header) []interface{}
}

type keyHolderJSONWebKeySet struct {
	keySet *jose.JSONWebKeySet
}

type keyHolderRSAPublicKeys struct {
	keys map[string]*rsa.PublicKey
}

type JWTDecoder struct {
	keys keyHolder
}

// Decode the claims.  Note: this does not validate!
func (d *JWTDecoder) Decode(text string) (map[string]interface{}, error) {
	object, err := jose.ParseSigned(text)
	if err != nil {
		return nil, err
	}

	if len(object.Signatures) != 1 {
		return nil, fmt.Errorf("Only single signatures are supported")
	}

	signature := object.Signatures[0]

	// algo := jose.SignatureAlgorithm(signature.Header.Algorithm)

	keys := d.keys.getVerificationKeys(signature.Header)
	if len(keys) == 0 {
		return nil, fmt.Errorf("no matching keys")
	}

	var payload []byte
	for _, key := range keys {
		payload, err = object.Verify(key)
		if err != nil {
			continue
		}
		break
	}

	if payload == nil {
		return nil, fmt.Errorf("no matching key")
	}

	claims := make(map[string]interface{})
	err = json.Unmarshal(payload, &claims)
	if err != nil {
		return nil, fmt.Errorf("Unable to parse claims from JWT")
	}

	return claims, nil
}

func (d *keyHolderRSAPublicKeys) getVerificationKeys(header jose.Header) []interface{} {

	var keys []interface{}
	key := d.keys[header.KeyID]
	if key == nil {
		if header.KeyID != "" {
			return nil
		}
		// TODO, array of all values?
	}
	return append(keys, key)
}

func (d *keyHolderJSONWebKeySet) getVerificationKeys(header jose.Header) []interface{} {
	var keys []interface{}
	for _, key := range d.keySet.Keys {
		if header.KeyID == "" || key.KeyID == header.KeyID {
			keys = append(keys, key)
		}
	}
	return keys
}

/***

  claims := &idToken{}
  err = json.Unmarshal(payload, idt)
  if err != nil {
    return nil, &VerifyErr{
      msg:    fmt.Sprintf("xjwt: payload did not contain JSON: %v", err.Error()),
      reason: JWT_MALFORMED,
    }
  }

  if vc.ExpectedIssuer != "" {
    if vc.ExpectedIssuer != idt.Issuer {
      return nil, &VerifyErr{
        msg:    fmt.Sprintf("xjwt: Issuer mismatch. '%s' != '%s'", vc.ExpectedIssuer, idt.Issuer),
        reason: JWT_EXPECT_MISMATCH,
      }
    }
  }

  if vc.ExpectedSubject != "" {
    if vc.ExpectedSubject != idt.Subject {
      return nil, &VerifyErr{
        msg:    fmt.Sprintf("xjwt: Subject mismatch. '%s' != '%s'", vc.ExpectedSubject, idt.Subject),
        reason: JWT_EXPECT_MISMATCH,
      }
    }
  }

  if vc.ExpectedNonce != "" {
    if vc.ExpectedNonce != idt.Nonce {
      return nil, &VerifyErr{
        msg:    fmt.Sprintf("xjwt: Nonce mismatch. '%s' != '%s'", vc.ExpectedNonce, idt.Nonce),
        reason: JWT_EXPECT_MISMATCH,
      }
    }
  }

  if vc.ExpectedAudience != "" {
    if len(idt.Audience) == 0 || !idt.Audience.contains(vc.ExpectedAudience) {
      return nil, &VerifyErr{
        msg:    fmt.Sprintf("xjwt: Audience mismatch. '%s' not in %v", vc.ExpectedAudience, idt.Audience),
        reason: JWT_EXPECT_MISMATCH,
      }
    }
  }

  expires := time.Time(idt.Expiry)
  if now.After(expires) {
    return nil, &VerifyErr{
      msg:    fmt.Sprintf("xjwt: JWT expired: now:'%s' is after jwt:'%s'", now.String(), expires.String()),
      reason: JWT_EXPIRED,
    }
  }

  maxExpires := vc.MaxExpirationFromNow
  if maxExpires == 0 {
    maxExpires = defaultMaxExpirationFromNow
  }

  if expires.After(now.Add(maxExpires)) {
    return nil, &VerifyErr{
      msg:    fmt.Sprintf("xjwt: JWT has invalid expiration: jwt:'%s' is too far in the future (max:'%s')", expires.String(), now.Add(maxExpires).String()),
      reason: JWT_EXPIRED,
    }
  }

  nbf := time.Time(idt.NotBefore)
  if now.Before(nbf) {
    return nil, &VerifyErr{
      msg:    fmt.Sprintf("xjwt: JWT nbf is before now: jwt:'%s' now:'%s'", nbf.String(), now.String()),
      reason: JWT_EXPIRED,
    }
  }


  return nil,nil
}
**/

// The simplest decoder
func newKeyHolder(source string) (keyHolder, error) {

	// Read the bytes
	bytes, err := getBytesForKeyfunc(source)
	if err != nil {
		return nil, fmt.Errorf("Error reading JWT Source: %v", err)
	}

	// Try to parse this as a JSON Web Key Set
	ks := &jose.JSONWebKeySet{}
	err = json.Unmarshal(bytes, ks)
	if err == nil && len(ks.Keys) > 0 {
		return &keyHolderJSONWebKeySet{
			keySet: ks,
		}, nil
	}

	// Try to parse as json
	reg := make(map[string]*rsa.PublicKey)
	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err == nil {
		// keyID -> Certificate (like firebase)
		for kid, value := range parsed {
			key, err := parseRSAPublicKeyFromPEM([]byte(value.(string)))
			if err == nil {
				reg[kid] = key
			}
		}
		if len(reg) > 0 {
			return &keyHolderRSAPublicKeys{
				keys: reg,
			}, nil
		}
	}

	// Is this a single certificaiton file
	key, err := parseRSAPublicKeyFromPEM(bytes)
	if err == nil {
		reg["key"] = key
		return &keyHolderRSAPublicKeys{
			keys: reg,
		}, nil
	}

	// TODO, base64 encoded bytes?
	return nil, fmt.Errorf("Unable to parse jwt keys")
}

// The simplest decoder
func NewJWTDecoder(source string) (*JWTDecoder, error) {
	holder, err := newKeyHolder(source)
	if err != nil {
		return nil, err
	}

	// TODO, add somethign to support a refresh

	return &JWTDecoder{
		keys: holder,
	}, nil
}

// Read bytes from a URL, File, or directly from the string
func getBytesForKeyfunc(cfg string) ([]byte, error) {
	// Check if it points to a URL
	if strings.HasPrefix(cfg, "http") {
		resp, err := http.Get(cfg)
		if err != nil {
			return nil, err
		}

		// Read the body
		defer resp.Body.Close()
		buf := new(bytes.Buffer)
		buf.ReadFrom(resp.Body)
		return buf.Bytes(), nil
	}

	// Try to read it as a file
	data, err := ioutil.ReadFile(cfg)
	if err == nil {
		return data, nil
	}

	// Otherwise use the string bytes directly
	return []byte(cfg), nil
}

// https://github.com/dgrijalva/jwt-go/blob/master/rsa_utils.go#L75
// Parse PEM encoded PKCS1 or PKCS8 public key
func parseRSAPublicKeyFromPEM(key []byte) (*rsa.PublicKey, error) {
	var err error

	// Parse PEM block
	var block *pem.Block
	if block, _ = pem.Decode(key); block == nil {
		return nil, fmt.Errorf("not pem")
	}

	// Parse the key
	var parsedKey interface{}
	if parsedKey, err = x509.ParsePKIXPublicKey(block.Bytes); err != nil {
		if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
			parsedKey = cert.PublicKey
		} else {
			return nil, err
		}
	}

	var pkey *rsa.PublicKey
	var ok bool
	if pkey, ok = parsedKey.(*rsa.PublicKey); !ok {
		return nil, fmt.Errorf("NotRSAPublicKey")
	}

	return pkey, nil
}
