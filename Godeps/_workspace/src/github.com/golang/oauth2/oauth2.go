// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package oauth2 provides support for making
// OAuth2 authorized and authenticated HTTP requests.
// It can additionally grant authorization with Bearer JWT.
package oauth2

import (
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"mime"
	"time"

	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// TokenStore implementations read and write OAuth 2.0 tokens from a persistence layer.
type TokenStore interface {
	// ReadToken reads the token from the store.
	// If the read is successful, it should return the token and a nil error.
	// The returned tokens may be expired tokens.
	// If there is no token in the store, it should return a nil token and a nil error.
	// It should return a non-nil error when an unrecoverable failure occurs.
	ReadToken() (*Token, error)
	// WriteToken writes the token to the cache.
	WriteToken(*Token)
}

// Option represents a function that applies some state to
// an Options object.
type Option func(*Options) error

// Client requires the OAuth 2.0 client credentials. You need to provide
// the client identifier and optionally the client secret that are
// assigned to your application by the OAuth 2.0 provider.
func Client(id, secret string) Option {
	return func(opts *Options) error {
		opts.ClientID = id
		opts.ClientSecret = secret
		return nil
	}
}

// RedirectURL requires the URL to which the user will be returned after
// granting (or denying) access.
func RedirectURL(url string) Option {
	return func(opts *Options) error {
		opts.RedirectURL = url
		return nil
	}
}

// Scope requires a list of requested permission scopes.
// It is optinal to specify scopes.
func Scope(scopes ...string) Option {
	return func(o *Options) error {
		o.Scopes = scopes
		return nil
	}
}

// Endpoint requires OAuth 2.0 provider's authorization and token endpoints.
func Endpoint(authURL, tokenURL string) Option {
	return func(o *Options) error {
		au, err := url.Parse(authURL)
		if err != nil {
			return err
		}
		tu, err := url.Parse(tokenURL)
		if err != nil {
			return err
		}
		o.AuthURL = au
		o.TokenURL = tu
		return nil
	}
}

// HTTPClient allows you to provide a custom http.Client to be
// used to retrieve tokens from the OAuth 2.0 provider.
func HTTPClient(c *http.Client) Option {
	return func(o *Options) error {
		o.Client = c
		return nil
	}
}

// New builds a new options object and determines the type of the OAuth 2.0
// (2-legged, 3-legged or custom) by looking at the provided options.
// If the flow type cannot determined automatically, an error is returned.
func New(option ...Option) (*Options, error) {
	opts := &Options{}
	for _, fn := range option {
		if err := fn(opts); err != nil {
			return nil, err
		}
	}
	switch {
	case opts.TokenFetcherFunc != nil:
		return opts, nil
	case opts.AUD != nil:
		// TODO(jbd): Assert the required JWT params.
		opts.TokenFetcherFunc = makeTwoLeggedFetcher(opts)
		return opts, nil
	case opts.AuthURL != nil && opts.TokenURL != nil:
		// TODO(jbd): Assert the required OAuth2 params.
		opts.TokenFetcherFunc = makeThreeLeggedFetcher(opts)
		return opts, nil
	default:
		return nil, errors.New("oauth2: missing endpoints, can't determine how to fetch tokens")
	}
}

// AuthCodeURL returns a URL to OAuth 2.0 provider's consent page
// that asks for permissions for the required scopes explicitly.
//
// State is a token to protect the user from CSRF attacks. You must
// always provide a non-zero string and validate that it matches the
// the state query parameter on your redirect callback.
// See http://tools.ietf.org/html/rfc6749#section-10.12 for more info.
//
// Access type is an OAuth extension that gets sent as the
// "access_type" field in the URL from AuthCodeURL.
// It may be "online" (default) or "offline".
// If your application needs to refresh access tokens when the
// user is not present at the browser, then use offline. This
// will result in your application obtaining a refresh token
// the first time your application exchanges an authorization
// code for a user.
//
// Approval prompt indicates whether the user should be
// re-prompted for consent. If set to "auto" (default) the
// user will be prompted only if they haven't previously
// granted consent and the code can only be exchanged for an
// access token. If set to "force" the user will always be prompted,
// and the code can be exchanged for a refresh token.
func (o *Options) AuthCodeURL(state, accessType, prompt string) string {
	u := *o.AuthURL
	v := url.Values{
		"response_type":   {"code"},
		"client_id":       {o.ClientID},
		"redirect_uri":    condVal(o.RedirectURL),
		"scope":           condVal(strings.Join(o.Scopes, " ")),
		"state":           condVal(state),
		"access_type":     condVal(accessType),
		"approval_prompt": condVal(prompt),
	}
	q := v.Encode()
	if u.RawQuery == "" {
		u.RawQuery = q
	} else {
		u.RawQuery += "&" + q
	}
	return u.String()
}

// exchange exchanges the authorization code with the OAuth 2.0 provider
// to retrieve a new access token.
func (o *Options) exchange(code string) (*Token, error) {
	return retrieveToken(o, url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": condVal(o.RedirectURL),
		"scope":        condVal(strings.Join(o.Scopes, " ")),
	})
}

// NewTransportFromTokenStore reads the token from the store and returns
// a Transport that is authorized and the authenticated
// by the returned token.
func (o *Options) NewTransportFromTokenStore(store TokenStore) (*Transport, error) {
	tok, err := store.ReadToken()
	if err != nil {
		return nil, err
	}
	o.TokenStore = store
	if tok == nil {
		return nil, nil
	}
	return o.newTransportFromToken(tok), nil
}

// NewTransportFromCode exchanges the code to retrieve a new access token
// and returns an authorized and authenticated Transport.
func (o *Options) NewTransportFromCode(code string) (*Transport, error) {
	token, err := o.exchange(code)
	if err != nil {
		return nil, err
	}
	return o.newTransportFromToken(token), nil
}

// NewTransport returns a Transport.
func (o *Options) NewTransport() *Transport {
	return o.newTransportFromToken(nil)
}

// newTransportFromToken returns a new Transport that is authorized
// and authenticated with the provided token.
func (o *Options) newTransportFromToken(t *Token) *Transport {
	// TODO(jbd): App Engine options initiate an http.Client that
	// depends on the urlfetcher, but it breaks the promise we made
	// that the options object should be working finely with nil-values
	// for the http.Client.
	tr := http.DefaultTransport
	if o.Client != nil && o.Client.Transport != nil {
		tr = o.Client.Transport
	}
	return newTransport(tr, o, t)
}

func makeThreeLeggedFetcher(o *Options) func(t *Token) (*Token, error) {
	return func(t *Token) (*Token, error) {
		if t == nil || t.RefreshToken == "" {
			return nil, errors.New("oauth2: cannot fetch access token without refresh token")
		}
		return retrieveToken(o, url.Values{
			"grant_type":    {"refresh_token"},
			"refresh_token": {t.RefreshToken},
		})
	}
}

// Options represents an object to keep the state of the OAuth 2.0 flow.
type Options struct {
	// ClientID is the OAuth client identifier used when communicating with
	// the configured OAuth provider.
	ClientID string

	// ClientSecret is the OAuth client secret used when communicating with
	// the configured OAuth provider.
	ClientSecret string

	// RedirectURL is the URL to which the user will be returned after
	// granting (or denying) access.
	RedirectURL string

	// Email is the OAuth client identifier used when communicating with
	// the configured OAuth provider.
	Email string

	// PrivateKey contains the contents of an RSA private key or the
	// contents of a PEM file that contains a private key. The provided
	// private key is used to sign JWT payloads.
	// PEM containers with a passphrase are not supported.
	// Use the following command to convert a PKCS 12 file into a PEM.
	//
	//    $ openssl pkcs12 -in key.p12 -out key.pem -nodes
	//
	PrivateKey *rsa.PrivateKey

	// Scopes identify the level of access being requested.
	Subject string

	// Scopes optionally specifies a list of requested permission scopes.
	Scopes []string

	// AuthURL represents the authorization endpoint of the OAuth 2.0 provider.
	AuthURL *url.URL

	// TokenURL represents the token endpoint of the OAuth 2.0 provider.
	TokenURL *url.URL

	// AUD represents the token endpoint required to complete the 2-legged JWT flow.
	AUD *url.URL

	// TokenStore reads a token from the store and writes it back to the store
	// if a token refresh occurs.
	// Optional.
	TokenStore TokenStore

	TokenFetcherFunc func(t *Token) (*Token, error)

	Client *http.Client
}

func retrieveToken(o *Options, v url.Values) (*Token, error) {
	v.Set("client_id", o.ClientID)
	bustedAuth := !providerAuthHeaderWorks(o.TokenURL.String())
	if bustedAuth && o.ClientSecret != "" {
		v.Set("client_secret", o.ClientSecret)
	}
	req, err := http.NewRequest("POST", o.TokenURL.String(), strings.NewReader(v.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if !bustedAuth && o.ClientSecret != "" {
		req.SetBasicAuth(o.ClientID, o.ClientSecret)
	}
	c := o.Client
	if c == nil {
		c = &http.Client{}
	}
	r, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("oauth2: cannot fetch token: %v", err)
	}
	if code := r.StatusCode; code < 200 || code > 299 {
		return nil, fmt.Errorf("oauth2: cannot fetch token: %v\nResponse: %s", r.Status, body)
	}

	token := &Token{}
	expires := int(0)
	content, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	switch content {
	case "application/x-www-form-urlencoded", "text/plain":
		vals, err := url.ParseQuery(string(body))
		if err != nil {
			return nil, err
		}
		token.AccessToken = vals.Get("access_token")
		token.TokenType = vals.Get("token_type")
		token.RefreshToken = vals.Get("refresh_token")
		token.raw = vals
		e := vals.Get("expires_in")
		if e == "" {
			// TODO(jbd): Facebook's OAuth2 implementation is broken and
			// returns expires_in field in expires. Remove the fallback to expires,
			// when Facebook fixes their implementation.
			e = vals.Get("expires")
		}
		expires, _ = strconv.Atoi(e)
	default:
		b := make(map[string]interface{})
		if err = json.Unmarshal(body, &b); err != nil {
			return nil, err
		}
		token.AccessToken, _ = b["access_token"].(string)
		token.TokenType, _ = b["token_type"].(string)
		token.RefreshToken, _ = b["refresh_token"].(string)
		token.raw = b
		e, ok := b["expires_in"].(float64)
		if !ok {
			// TODO(jbd): Facebook's OAuth2 implementation is broken and
			// returns expires_in field in expires. Remove the fallback to expires,
			// when Facebook fixes their implementation.
			e, _ = b["expires"].(float64)
		}
		expires = int(e)
	}
	// Don't overwrite `RefreshToken` with an empty value
	// if this was a token refreshing request.
	if token.RefreshToken == "" {
		token.RefreshToken = v.Get("refresh_token")
	}
	if expires == 0 {
		token.Expiry = time.Time{}
	} else {
		token.Expiry = time.Now().Add(time.Duration(expires) * time.Second)
	}
	return token, nil
}

func condVal(v string) []string {
	if v == "" {
		return nil
	}
	return []string{v}
}

// providerAuthHeaderWorks reports whether the OAuth2 server identified by the tokenURL
// implements the OAuth2 spec correctly
// See https://code.google.com/p/goauth2/issues/detail?id=31 for background.
// In summary:
// - Reddit only accepts client secret in the Authorization header
// - Dropbox accepts either it in URL param or Auth header, but not both.
// - Google only accepts URL param (not spec compliant?), not Auth header
func providerAuthHeaderWorks(tokenURL string) bool {
	if strings.HasPrefix(tokenURL, "https://accounts.google.com/") ||
		strings.HasPrefix(tokenURL, "https://github.com/") ||
		strings.HasPrefix(tokenURL, "https://api.instagram.com/") ||
		strings.HasPrefix(tokenURL, "https://www.douban.com/") ||
		strings.HasPrefix(tokenURL, "https://api.dropbox.com/") ||
		strings.HasPrefix(tokenURL, "https://api.soundcloud.com/") ||
		strings.HasPrefix(tokenURL, "https://www.linkedin.com/") {
		// Some sites fail to implement the OAuth2 spec fully.
		return false
	}

	// Assume the provider implements the spec properly
	// otherwise. We can add more exceptions as they're
	// discovered. We will _not_ be adding configurable hooks
	// to this package to let users select server bugs.
	return true
}
