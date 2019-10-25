package social

import (
	"fmt"
	"net/http"

	jwt "github.com/dgrijalva/jwt-go"
	"golang.org/x/oauth2"
)

type Token struct {
	token         *oauth2.Token
	jwksCert      string
	wellKnownUrl  string
	signingSecret string
}

func NewToken(token *oauth2.Token, wellKnownUrl string) Token {
	return Token{
		token:        token,
		wellKnownUrl: wellKnownUrl,
	}
}

//Parse parses and validates the token
func (t *Token) Parse() (*jwt.Token, error) {
	idToken := t.token.Extra("id_token")
	if idToken == nil {
		return nil, fmt.Errorf("No id_token found")
	}

	parsedToken, err := jwt.Parse(idToken.(string), func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
		}

		if t.signingSecret == "" {
			var err error
			t.signingSecret, err = t.getSigningSecret(token.Header["kid"].(string))
			if err != nil {
				return nil, fmt.Errorf("Error getting Azure AD signing secret: %s", err)
			}
		}

		rsa, err := jwt.ParseRSAPublicKeyFromPEM([]byte(t.signingSecret))
		if err != nil {
			return nil, fmt.Errorf("Error getting Azure AD signing secret: %s", err)
		}

		return rsa, nil
	})

	if err != nil {
		return nil, fmt.Errorf("Error parsing jwt token: %s", err)
	}

	return parsedToken, nil
}

func (t *Token) getSigningSecret(kid string) (string, error) {
	openId, err := NewOpenIDConfig(http.DefaultClient, t.wellKnownUrl)
	if err != nil {
		return "", fmt.Errorf("Error getting jwks: %s", err)
	}

	jwks, err := NewJwks(http.DefaultClient, openId.JwksUri)
	if err != nil {
		return "", fmt.Errorf("Error getting jwks: %s", err)
	}

	secret := jwks.GetCertForKid(kid)

	return secret, nil
}
