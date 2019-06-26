package util

import (
	jose "gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"

	"crypto/x509"
	"encoding/base64"
	"encoding/pem"

	"sync"

	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

//------------------------------------------------------------------
// Error Handling
//------------------------------------------------------------------

type JWTErrorCode uint8

const (
	JWT_ERROR_UnableToRead  JWTErrorCode = 1
	JWT_ERROR_Unsupported   JWTErrorCode = 2
	JWT_ERROR_UnknownKey    JWTErrorCode = 3
	JWT_ERROR_DecryptFailed JWTErrorCode = 4
	JWT_ERROR_Expired       JWTErrorCode = 5
	JWT_ERROR_Unexpected    JWTErrorCode = 6
	JWT_ERROR_NotReadyYet   JWTErrorCode = 7
)

type JWTError struct {
	msg            string
	HttpStatusCode int
	Code           JWTErrorCode
}

func (e *JWTError) Error() string {
	return e.msg
}

func newJWTError(code JWTErrorCode, format string, args ...interface{}) *JWTError {
	status := http.StatusUnauthorized
	switch code {
	case JWT_ERROR_UnableToRead:
		status = http.StatusBadRequest
	case JWT_ERROR_Unsupported:
		status = http.StatusBadRequest
	case JWT_ERROR_UnknownKey:
		status = http.StatusUnauthorized
	case JWT_ERROR_DecryptFailed:
		status = http.StatusUnauthorized
	case JWT_ERROR_Expired:
		status = http.StatusUnauthorized
	case JWT_ERROR_Unexpected:
		status = http.StatusUnauthorized
	}

	return &JWTError{
		Code:           code,
		HttpStatusCode: status,
		msg:            fmt.Sprintf(format, args...),
	}
}

//------------------------------------------------------------------
// Key source - get a key for a given header
//------------------------------------------------------------------

type keySource interface {
	getVerificationKeys(header jose.Header) []interface{}
}

//------------------------------------------------------------------
// Key source - get a key for a given header
//------------------------------------------------------------------

type JWTDecoder struct {
	// Path to Public Keys
	source string

	// Reload the public keys after this time
	TTL time.Duration

	// When the keys were loaded
	loaded time.Time

	// Used for key reload
	mutex *sync.Mutex

	// Public Key holder
	keys keySource

	// Verify tokens have these claims
	ExpectClaims map[string]string

	// Used for testing
	Now func() time.Time
}

func NewJWTDecoder(source string) *JWTDecoder {
	return &JWTDecoder{
		source: source,
		mutex:  &sync.Mutex{},
		Now:    time.Now,
		loaded: time.Now(),
	}
}

// Check if the decoder is ready to decode
func (d *JWTDecoder) CheckReady() bool {
	if d == nil {
		return false
	}

	// Make sure the keys have been loaded
	if d.keys == nil {
		if d.source == "" {
			return false
		}
		keys, err := newKeySource(d.source)
		if err == nil {
			d.keys = keys
			d.loaded = d.Now()
		} else {
			return false
		}
	}

	// Make sure there are some keys
	h := &jose.Header{}
	return len(d.keys.getVerificationKeys(*h)) > 0
}

func getTimeFromClaim(val interface{}) time.Time {
	unix, ok := val.(int64)
	if !ok {
		unix = int64(val.(float64))
	}
	return time.Unix(unix, 0)
}

// Decode ... Read the claims and validate
func (d *JWTDecoder) Decode(text string) (map[string]interface{}, *JWTError) {
	if d.keys == nil {
		return nil, newJWTError(JWT_ERROR_NotReadyYet, "Decode not initalized")
	}

	xxx, err := jwt.ParseSigned(text)
	if err != nil {
		return nil, newJWTError(JWT_ERROR_UnableToRead, "Could not parse")
	}

	expected := jwt.Expected{}.WithTime(time.Now())
	fmt.Println("JWT:", xxx, expected)

	object, err := jose.ParseSigned(text)
	if err != nil {
		return nil, newJWTError(JWT_ERROR_UnableToRead, "Could not parse")
	}

	if len(object.Signatures) != 1 {
		return nil, newJWTError(JWT_ERROR_Unsupported,
			"Only single signatures are supported")
	}

	// Check if we should reload the public keys
	now := d.Now()
	if d.TTL > 0 {
		d.mutex.Lock()
		if now.After(d.loaded.Add(d.TTL)) {
			keys, err := newKeySource(d.source)
			if err == nil {
				d.keys = keys
				d.loaded = d.Now()
			} else {
				// Try again in 30 seconds
				d.loaded = now.Add(d.TTL).Add(time.Duration(-30) * time.Second)
			}
		}
		d.mutex.Unlock()
	}

	// Find the verification keys
	signature := object.Signatures[0]
	keys := d.keys.getVerificationKeys(signature.Header)
	if len(keys) == 0 {
		return nil, newJWTError(JWT_ERROR_UnknownKey, "Key Not Found")
	}

	// Find the first payload that has a valid signature
	var payload []byte
	for _, key := range keys {
		payload, err = object.Verify(key)
		if err != nil {
			continue
		}
		break
	}

	if payload == nil {
		return nil, newJWTError(JWT_ERROR_DecryptFailed, "")
	}

	// Map th evalues to a claim
	claims := make(map[string]interface{})
	err = json.Unmarshal(payload, &claims)
	if err != nil || len(claims) < 1 {
		return nil, newJWTError(JWT_ERROR_UnableToRead, "Missing Claims")
	}

	// Check expiration
	if val, ok := claims["exp"]; ok {
		if now.After(getTimeFromClaim(val)) {
			return claims, newJWTError(JWT_ERROR_Expired, "Expired")
		}
	}

	// Not Before
	if val, ok := claims["nbf"]; ok {
		if now.Before(getTimeFromClaim(val)) {
			return claims, newJWTError(JWT_ERROR_Expired, "Before Now")
		}
	}

	// Checking all expected claims
	if d.ExpectClaims != nil {
		for k, v := range d.ExpectClaims {
			if v != claims[k] {
				return claims, newJWTError(JWT_ERROR_Unexpected, "Mismatch: "+k)
			}
		}
	}
	return claims, nil
}

//-------------------------------------------------
// 3 flavors that hold keys
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

// The simplest decoder
func newKeySource(source string) (keySource, error) {

	// Read the bytes
	bytes, err := getBytesForSource(source)
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

	return nil, fmt.Errorf("Unable to parse jwt keys")
}

// Read bytes from a URL, File, or directly from the string
func getBytesForSource(source string) ([]byte, error) {
	// Check if it points to a URL
	if strings.HasPrefix(source, "http") {
		resp, err := http.Get(source)
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
	data, err := ioutil.ReadFile(source)
	if err == nil {
		return data, nil
	}

	// To to base64 encode it
	data, err = base64.StdEncoding.DecodeString(source)
	if err != nil {
		return data, nil
	}

	// Otherwise use the string bytes directly
	return []byte(source), nil
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
