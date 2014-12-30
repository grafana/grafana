// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package oauth2_test

import (
	"fmt"
	"log"
	"testing"

	"golang.org/x/oauth2"
)

// TODO(jbd): Remove after Go 1.4.
// Related to https://codereview.appspot.com/107320046
func TestA(t *testing.T) {}

func ExampleConfig() {
	conf := &oauth2.Config{
		ClientID:     "YOUR_CLIENT_ID",
		ClientSecret: "YOUR_CLIENT_SECRET",
		Scopes:       []string{"SCOPE1", "SCOPE2"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://provider.com/o/oauth2/auth",
			TokenURL: "https://provider.com/o/oauth2/token",
		},
	}

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	url := conf.AuthCodeURL("state", oauth2.AccessTypeOffline)
	fmt.Printf("Visit the URL for the auth dialog: %v", url)

	// Use the authorization code that is pushed to the redirect URL.
	// NewTransportWithCode will do the handshake to retrieve
	// an access token and initiate a Transport that is
	// authorized and authenticated by the retrieved token.
	var code string
	if _, err := fmt.Scan(&code); err != nil {
		log.Fatal(err)
	}
	tok, err := conf.Exchange(oauth2.NoContext, code)
	if err != nil {
		log.Fatal(err)
	}

	client := conf.Client(oauth2.NoContext, tok)
	client.Get("...")
}

func ExampleJWTConfig() {
	var initialToken *oauth2.Token // nil means no initial token
	conf := &oauth2.JWTConfig{
		Email: "xxx@developer.com",
		// The contents of your RSA private key or your PEM file
		// that contains a private key.
		// If you have a p12 file instead, you
		// can use `openssl` to export the private key into a pem file.
		//
		//    $ openssl pkcs12 -in key.p12 -out key.pem -nodes
		//
		// It only supports PEM containers with no passphrase.
		PrivateKey: []byte("-----BEGIN RSA PRIVATE KEY-----..."),
		Subject:    "user@example.com",
		TokenURL:   "https://provider.com/o/oauth2/token",
	}
	// Initiate an http.Client, the following GET request will be
	// authorized and authenticated on the behalf of user@example.com.
	client := conf.Client(oauth2.NoContext, initialToken)
	client.Get("...")
}
