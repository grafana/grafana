package github

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	// JWTExpirationMinutes is the token expiration time for GitHub App JWT tokens
	// TODO: this could be in settings
	JWTExpirationMinutes = 10
)

// GenerateJWTToken creates a GitHub App JWT token from appID and base64-encoded private key.
// The private key should be base64-encoded PEM format.
// Returns the signed JWT token string.
// related to how Github wants their token to be built.
func GenerateJWTToken(appID string, privateKey common.RawSecureValue) (common.RawSecureValue, error) {
	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKey))
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	// Parse the private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the JWT token
	now := time.Now()
	claims := jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(JWTExpirationMinutes) * time.Minute)),
		Issuer:    appID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return common.RawSecureValue(signedToken), nil
}

func getExpirationFromToken(token, privateKey common.RawSecureValue) (time.Time, error) {
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKey))
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	key, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse private key: %w", err)
	}

	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithoutClaimsValidation(),
	)
	parsedToken, err := parser.ParseWithClaims(string(token), &jwt.RegisteredClaims{}, func(_ *jwt.Token) (any, error) {
		return &key.PublicKey, nil
	})
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := parsedToken.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return time.Time{}, fmt.Errorf("unexpected token claims")
	}

	return claims.ExpiresAt.Time, nil
}
