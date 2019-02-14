package util

import (
	"gopkg.in/square/go-jose.v2"

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

type keySource interface {
	getVerificationKeys(header jose.Header) []interface{}
}

type JWTDecoder struct {
	keys keySource
}

// Check if the decoder is ready to decode
func (d *JWTDecoder) IsReady() bool {
	fmt.Printf("READY? %v", d)

	if d == nil || d.keys == nil {
		return false
	}

	h := &jose.Header{
		// NO KID
	}
	if len(d.keys.getVerificationKeys(*h)) < 1 {
		return false
	}

	return true
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
	if err != nil || len(claims) < 1 {
		return claims, fmt.Errorf("Unable to parse claims from JWT")
	}

	// expires := time.Time(idt.Expiry)
	// if now.After(expires) {
	//   return nil, &VerifyErr{
	//     msg:    fmt.Sprintf("xjwt: JWT expired: now:'%s' is after jwt:'%s'", now.String(), expires.String()),
	//     reason: JWT_EXPIRED,
	//   }
	// }

	// maxExpires := vc.MaxExpirationFromNow
	// if maxExpires == 0 {
	//   maxExpires = defaultMaxExpirationFromNow
	// }

	// if expires.After(now.Add(maxExpires)) {
	//   return nil, &VerifyErr{
	//     msg:    fmt.Sprintf("xjwt: JWT has invalid expiration: jwt:'%s' is too far in the future (max:'%s')", expires.String(), now.Add(maxExpires).String()),
	//     reason: JWT_EXPIRED,
	//   }
	// }

	// nbf := time.Time(idt.NotBefore)
	// if now.Before(nbf) {
	//   return nil, &VerifyErr{
	//     msg:    fmt.Sprintf("xjwt: JWT nbf is before now: jwt:'%s' now:'%s'", nbf.String(), now.String()),
	//     reason: JWT_EXPIRED,
	//   }
	// }

	return claims, nil
}

//-------------------------------------------------
// 3 simple flavors that hold keys
//-------------------------------------------------

type keySourceJSONWebKeySet struct {
	keySet *jose.JSONWebKeySet
}

type keySourceKeySet struct {
	keys map[string]interface{}
}

type keySourceKeys struct {
	keys []interface{}
}

func (d *keySourceJSONWebKeySet) getVerificationKeys(header jose.Header) []interface{} {
	var keys []interface{}
	for _, key := range d.keySet.Keys {
		if header.KeyID == "" || key.KeyID == header.KeyID {
			keys = append(keys, key)
		}
	}
	return keys
}

func (d *keySourceKeySet) getVerificationKeys(header jose.Header) []interface{} {

	var keys []interface{}
	key := d.keys[header.KeyID]
	if key == nil {
		if header.KeyID != "" {
			return nil
		}
		// // Try all the keys
		// for _, value := range d.keys {
		//   append(keys, value)
		// }
	}
	return append(keys, key)
}

func (d *keySourceKeys) getVerificationKeys(header jose.Header) []interface{} {
	return d.keys
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
func newKeySource(source string) (keySource, error) {

	// Read the bytes
	bytes, err := getBytesForKeyfunc(source)
	if err != nil {
		return nil, fmt.Errorf("Error reading JWT Source: %v", err)
	}

	// Try to parse this as a JSON Web Key Set
	ks := &jose.JSONWebKeySet{}
	err = json.Unmarshal(bytes, ks)
	if err == nil && len(ks.Keys) > 0 {
		return &keySourceJSONWebKeySet{
			keySet: ks,
		}, nil
	}

	// Try to parse as json
	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err == nil {
		// keyID -> Certificate (like firebase)
		reg := make(map[string]interface{})
		for kid, value := range parsed {
			key, err := LoadPublicKey([]byte(value.(string)))
			if err == nil {
				reg[kid] = key
			}
		}
		if len(reg) > 0 {
			return &keySourceKeySet{
				keys: reg,
			}, nil
		}
	}

	// Is this a single public key file
	key, err := LoadPublicKey(bytes)
	if err == nil {
		var keys []interface{}
		return &keySourceKeys{
			keys: append(keys, key),
		}, nil
	}

	// TODO, base64 encoded bytes?
	return nil, fmt.Errorf("Unable to parse jwt keys")
}

// The simplest decoder
func NewJWTDecoder(source string) (*JWTDecoder, error) {
	keys, err := newKeySource(source)
	if err != nil {
		return nil, err
	}

	// TODO, add somethign to support a refresh/reload

	return &JWTDecoder{
		keys: keys,
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

//------------------------------------------------------------------
// https://github.com/square/go-jose/blob/v2.2.2/jose-util/utils.go
// TODO? is there a way to just import this???
//------------------------------------------------------------------

func LoadJSONWebKey(json []byte, pub bool) (*jose.JSONWebKey, error) {
	var jwk jose.JSONWebKey
	err := jwk.UnmarshalJSON(json)
	if err != nil {
		return nil, err
	}
	if !jwk.Valid() {
		return nil, fmt.Errorf("invalid JWK key")
	}
	if jwk.IsPublic() != pub {
		return nil, fmt.Errorf("priv/pub JWK key mismatch")
	}
	return &jwk, nil
}

// LoadPublicKey loads a public key from PEM/DER/JWK-encoded data.
func LoadPublicKey(data []byte) (interface{}, error) {
	input := data

	block, _ := pem.Decode(data)
	if block != nil {
		input = block.Bytes
	}

	// Try to load SubjectPublicKeyInfo
	pub, err0 := x509.ParsePKIXPublicKey(input)
	if err0 == nil {
		return pub, nil
	}

	cert, err1 := x509.ParseCertificate(input)
	if err1 == nil {
		return cert.PublicKey, nil
	}

	jwk, err2 := LoadJSONWebKey(data, true)
	if err2 == nil {
		return jwk, nil
	}

	return nil, fmt.Errorf("square/go-jose: parse error, got '%s', '%s' and '%s'", err0, err1, err2)
}

// LoadPrivateKey loads a private key from PEM/DER/JWK-encoded data.
func LoadPrivateKey(data []byte) (interface{}, error) {
	input := data

	block, _ := pem.Decode(data)
	if block != nil {
		input = block.Bytes
	}

	var priv interface{}
	priv, err0 := x509.ParsePKCS1PrivateKey(input)
	if err0 == nil {
		return priv, nil
	}

	priv, err1 := x509.ParsePKCS8PrivateKey(input)
	if err1 == nil {
		return priv, nil
	}

	priv, err2 := x509.ParseECPrivateKey(input)
	if err2 == nil {
		return priv, nil
	}

	jwk, err3 := LoadJSONWebKey(input, false)
	if err3 == nil {
		return jwk, nil
	}

	return nil, fmt.Errorf("square/go-jose: parse error, got '%s', '%s', '%s' and '%s'", err0, err1, err2, err3)
}
