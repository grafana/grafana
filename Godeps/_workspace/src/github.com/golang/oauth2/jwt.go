// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package oauth2

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang/oauth2/internal"
	"github.com/golang/oauth2/jws"
)

var (
	defaultGrantType = "urn:ietf:params:oauth:grant-type:jwt-bearer"
	defaultHeader    = &jws.Header{Algorithm: "RS256", Typ: "JWT"}
)

// JWTClient requires OAuth 2.0 JWT credentials.
// Required for the 2-legged JWT flow.
func JWTClient(email string, key []byte) Option {
	return func(o *Options) error {
		pk, err := internal.ParseKey(key)
		if err != nil {
			return err
		}
		o.Email = email
		o.PrivateKey = pk
		return nil
	}
}

// JWTEndpoint requires the JWT token endpoint of the OAuth 2.0 provider.
func JWTEndpoint(aud string) Option {
	return func(o *Options) error {
		au, err := url.Parse(aud)
		if err != nil {
			return err
		}
		o.AUD = au
		return nil
	}
}

// Subject requires a user to impersonate.
// Optional.
func Subject(user string) Option {
	return func(o *Options) error {
		o.Subject = user
		return nil
	}
}

func makeTwoLeggedFetcher(o *Options) func(t *Token) (*Token, error) {
	return func(t *Token) (*Token, error) {
		if t == nil {
			t = &Token{}
		}
		claimSet := &jws.ClaimSet{
			Iss:   o.Email,
			Scope: strings.Join(o.Scopes, " "),
			Aud:   o.AUD.String(),
		}
		if o.Subject != "" {
			claimSet.Sub = o.Subject
			// prn is the old name of sub. Keep setting it
			// to be compatible with legacy OAuth 2.0 providers.
			claimSet.Prn = o.Subject
		}
		payload, err := jws.Encode(defaultHeader, claimSet, o.PrivateKey)
		if err != nil {
			return nil, err
		}
		v := url.Values{}
		v.Set("grant_type", defaultGrantType)
		v.Set("assertion", payload)
		c := o.Client
		if c == nil {
			c = &http.Client{}
		}
		resp, err := c.PostForm(o.AUD.String(), v)
		if err != nil {
			return nil, fmt.Errorf("oauth2: cannot fetch token: %v", err)
		}
		defer resp.Body.Close()
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("oauth2: cannot fetch token: %v", err)
		}
		if c := resp.StatusCode; c < 200 || c > 299 {
			return nil, fmt.Errorf("oauth2: cannot fetch token: %v\nResponse: %s", resp.Status, body)
		}
		b := make(map[string]interface{})
		if err := json.Unmarshal(body, &b); err != nil {
			return nil, fmt.Errorf("oauth2: cannot fetch token: %v", err)
		}
		token := &Token{}
		token.AccessToken, _ = b["access_token"].(string)
		token.TokenType, _ = b["token_type"].(string)
		token.raw = b
		if e, ok := b["expires_in"].(int); ok {
			token.Expiry = time.Now().Add(time.Duration(e) * time.Second)
		}
		if idtoken, ok := b["id_token"].(string); ok {
			// decode returned id token to get expiry
			claimSet, err := jws.Decode(idtoken)
			if err != nil {
				return nil, fmt.Errorf("oauth2: cannot fetch token: %v", err)
			}
			token.Expiry = time.Unix(claimSet.Exp, 0)
			return token, nil
		}
		return token, nil
	}
}
