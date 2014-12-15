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
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/golang/oauth2"
	"github.com/golang/oauth2/internal"
)

var (
	uriGoogleAuth, _  = url.Parse("https://accounts.google.com/o/oauth2/auth")
	uriGoogleToken, _ = url.Parse("https://accounts.google.com/o/oauth2/token")
)

type metaTokenRespBody struct {
	AccessToken string        `json:"access_token"`
	ExpiresIn   time.Duration `json:"expires_in"`
	TokenType   string        `json:"token_type"`
}

// JWTEndpoint adds the endpoints required to complete the 2-legged service account flow.
func JWTEndpoint() oauth2.Option {
	return func(opts *oauth2.Options) error {
		opts.AUD = uriGoogleToken
		return nil
	}
}

// Endpoint adds the endpoints required to do the 3-legged Web server flow.
func Endpoint() oauth2.Option {
	return func(opts *oauth2.Options) error {
		opts.AuthURL = uriGoogleAuth
		opts.TokenURL = uriGoogleToken
		return nil
	}
}

// ComputeEngineAccount uses the specified account to retrieve an access
// token from the Google Compute Engine's metadata server. If no user is
// provided, "default" is being used.
func ComputeEngineAccount(account string) oauth2.Option {
	return func(opts *oauth2.Options) error {
		if account == "" {
			account = "default"
		}
		opts.TokenFetcherFunc = makeComputeFetcher(opts, account)
		return nil
	}
}

// ServiceAccountJSONKey uses the provided Google Developers
// JSON key file to authorize the user. See the "Credentials" page under
// "APIs & Auth" for your project at https://console.developers.google.com
// to download a JSON key file.
func ServiceAccountJSONKey(filename string) oauth2.Option {
	return func(opts *oauth2.Options) error {
		b, err := ioutil.ReadFile(filename)
		if err != nil {
			return err
		}
		var key struct {
			Email      string `json:"client_email"`
			PrivateKey string `json:"private_key"`
		}
		if err := json.Unmarshal(b, &key); err != nil {
			return err
		}
		pk, err := internal.ParseKey([]byte(key.PrivateKey))
		if err != nil {
			return err
		}
		opts.Email = key.Email
		opts.PrivateKey = pk
		opts.AUD = uriGoogleToken
		return nil
	}
}

func makeComputeFetcher(opts *oauth2.Options, account string) func(*oauth2.Token) (*oauth2.Token, error) {
	return func(t *oauth2.Token) (*oauth2.Token, error) {
		u := "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/" + account + "/token"
		req, err := http.NewRequest("GET", u, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Add("X-Google-Metadata-Request", "True")
		c := &http.Client{}
		if opts.Client != nil {
			c = opts.Client
		}
		resp, err := c.Do(req)
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
}
