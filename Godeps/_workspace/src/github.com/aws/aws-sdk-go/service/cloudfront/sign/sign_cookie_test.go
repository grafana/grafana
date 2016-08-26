package sign

import (
	"crypto/rsa"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewCookieSigner(t *testing.T) {
	privKey, err := rsa.GenerateKey(randReader, 1024)
	if err != nil {
		t.Fatalf("Unexpected priv key error, %#v", err)
	}

	signer := NewCookieSigner("keyID", privKey)
	assert.Equal(t, "keyID", signer.keyID)
	assert.Equal(t, privKey, signer.privKey)
}

func TestSignCookie(t *testing.T) {
	privKey, err := rsa.GenerateKey(randReader, 1024)
	assert.NoError(t, err)

	signer := NewCookieSigner("keyID", privKey)
	cookies, err := signer.Sign("http*://*", time.Now().Add(1*time.Hour))

	assert.NoError(t, err)
	assert.Equal(t, CookiePolicyName, cookies[0].Name)
	assert.Equal(t, CookieSignatureName, cookies[1].Name)
	assert.Equal(t, CookieKeyIDName, cookies[2].Name)
}

func TestSignCookie_WithPolicy(t *testing.T) {
	privKey, err := rsa.GenerateKey(randReader, 1024)
	assert.NoError(t, err)

	p := &Policy{
		Statements: []Statement{
			{
				Resource: "*",
				Condition: Condition{
					DateLessThan: &AWSEpochTime{time.Now().Add(1 * time.Hour)},
				},
			},
		},
	}

	signer := NewCookieSigner("keyID", privKey)
	cookies, err := signer.SignWithPolicy(p)

	assert.NoError(t, err)
	assert.Equal(t, CookiePolicyName, cookies[0].Name)
	assert.Equal(t, CookieSignatureName, cookies[1].Name)
	assert.Equal(t, CookieKeyIDName, cookies[2].Name)
}

func TestSignCookie_WithCookieOptions(t *testing.T) {
	privKey, err := rsa.GenerateKey(randReader, 1024)
	assert.NoError(t, err)

	expires := time.Now().Add(1 * time.Hour)

	signer := NewCookieSigner("keyID", privKey)
	cookies, err := signer.Sign("https://example.com/*", expires, func(o *CookieOptions) {
		o.Path = "/"
		o.Domain = ".example.com"
		o.Secure = true

	})

	assert.NoError(t, err)
	assert.Equal(t, CookiePolicyName, cookies[0].Name)
	assert.Equal(t, CookieSignatureName, cookies[1].Name)
	assert.Equal(t, CookieKeyIDName, cookies[2].Name)

	for _, c := range cookies {
		assert.Equal(t, "/", c.Path)
		assert.Equal(t, ".example.com", c.Domain)
		assert.True(t, c.Secure)
	}
}
