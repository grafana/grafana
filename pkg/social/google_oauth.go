package social

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGoogle struct {
	*oauth2.Config
	allowedDomains []string
	hostedDomain   string
	apiUrl         string
	allowSignup    bool
}

func (s *SocialGoogle) Type() int {
	return int(models.GOOGLE)
}

func (s *SocialGoogle) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialGoogle) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialGoogle) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	var err error

	r, err := client.Get(s.apiUrl)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}
	return &BasicUserInfo{
		Name:  data.Name,
		Email: data.Email,
		Login: data.Email,
	}, nil
}

func (s *SocialGoogle) Scopes() []string {
	return s.Config.Scopes
}

func (s *SocialGoogle) TokenScopes(token *oauth2.Token) ([]string, error) {
	// TODO: I wasn't able to determine how to extract scopes here
	// token.Extra("id_token") is a JWS but it doesn't contain scope names
	return s.Config.Scopes, nil
}
