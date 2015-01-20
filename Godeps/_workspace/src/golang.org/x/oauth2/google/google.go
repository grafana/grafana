// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package google provides support for making
// OAuth2 authorized and authenticated HTTP requests
// to Google APIs. It supports Web server, client-side,
// service accounts, Google Compute Engine service accounts,
// and Google App Engine service accounts authorization
// and authentications flows:
//
// For more information, please read
// https://developers.google.com/accounts/docs/OAuth2.
package google

import (
	"encoding/json"

	"fmt"
	"net"
	"net/http"
	"time"

	"golang.org/x/oauth2"
)

// Endpoint is Google's OAuth 2.0 endpoint.
var Endpoint = oauth2.Endpoint{
	AuthURL:  "https://accounts.google.com/o/oauth2/auth",
	TokenURL: "https://accounts.google.com/o/oauth2/token",
}

// JWTTokenURL is Google's OAuth 2.0 token URL to use with the JWT flow.
const JWTTokenURL = "https://accounts.google.com/o/oauth2/token"

// JWTConfigFromJSON uses a Google Developers service account JSON key file to read
// the credentials that authorize and authenticate the requests.
// Create a service account on "Credentials" page under "APIs & Auth" for your
// project at https://console.developers.google.com to download a JSON key file.
func JWTConfigFromJSON(ctx oauth2.Context, jsonKey []byte, scope ...string) (*oauth2.JWTConfig, error) {
	var key struct {
		Email      string `json:"client_email"`
		PrivateKey string `json:"private_key"`
	}
	if err := json.Unmarshal(jsonKey, &key); err != nil {
		return nil, err
	}
	return &oauth2.JWTConfig{
		Email:      key.Email,
		PrivateKey: []byte(key.PrivateKey),
		Scopes:     scope,
		TokenURL:   JWTTokenURL,
	}, nil
}

type metaTokenRespBody struct {
	AccessToken string        `json:"access_token"`
	ExpiresIn   time.Duration `json:"expires_in"`
	TokenType   string        `json:"token_type"`
}

// ComputeTokenSource returns a token source that fetches access tokens
// from Google Compute Engine (GCE)'s metadata server. It's only valid to use
// this token source if your program is running on a GCE instance.
// If no account is specified, "default" is used.
// Further information about retrieving access tokens from the GCE metadata
// server can be found at https://cloud.google.com/compute/docs/authentication.
func ComputeTokenSource(account string) oauth2.TokenSource {
	return &computeSource{account: account}
}

type computeSource struct {
	account string
}

var metaClient = &http.Client{
	Transport: &http.Transport{
		Dial: (&net.Dialer{
			Timeout:   750 * time.Millisecond,
			KeepAlive: 30 * time.Second,
		}).Dial,
		ResponseHeaderTimeout: 750 * time.Millisecond,
	},
}

func (cs *computeSource) Token() (*oauth2.Token, error) {
	acct := cs.account
	if acct == "" {
		acct = "default"
	}
	u := "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/" + acct + "/token"
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("X-Google-Metadata-Request", "True")
	resp, err := metaClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, fmt.Errorf("oauth2: can't retrieve a token from metadata server, status code: %d", resp.StatusCode)
	}
	var tokenResp metaTokenRespBody
	err = json.NewDecoder(resp.Body).Decode(&tokenResp)
	if err != nil {
		return nil, err
	}
	return &oauth2.Token{
		AccessToken: tokenResp.AccessToken,
		TokenType:   tokenResp.TokenType,
		Expiry:      time.Now().Add(tokenResp.ExpiresIn * time.Second),
	}, nil
}
