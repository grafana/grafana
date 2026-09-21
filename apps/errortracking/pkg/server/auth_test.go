package server

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

func TestValidateRegisteredClaims(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, nil)
	if err != nil {
		t.Fatal(err)
	}
	valid := jwt.Claims{
		Issuer:   "auth",
		Audience: jwt.Audience{Audience},
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}
	token := func(claims jwt.Claims) string {
		raw, err := jwt.Signed(signer).Claims(claims).Serialize()
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	if err := validateRegisteredClaims(token(valid), "auth", Audience); err != nil {
		t.Fatalf("valid claims rejected: %v", err)
	}

	tests := []struct {
		name   string
		claims jwt.Claims
	}{
		{name: "missing expiry", claims: jwt.Claims{Issuer: "auth", Audience: jwt.Audience{Audience}}},
		{name: "expired", claims: jwt.Claims{Issuer: "auth", Audience: jwt.Audience{Audience}, Expiry: jwt.NewNumericDate(time.Now().Add(-time.Minute))}},
		{name: "wrong issuer", claims: jwt.Claims{Issuer: "other", Audience: jwt.Audience{Audience}, Expiry: valid.Expiry}},
		{name: "wrong audience", claims: jwt.Claims{Issuer: "auth", Audience: jwt.Audience{"other"}, Expiry: valid.Expiry}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateRegisteredClaims(token(test.claims), "auth", Audience); err == nil {
				t.Fatal("expected claims to be rejected")
			}
		})
	}
}
