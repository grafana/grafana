// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package oauth2_test

import (
	"fmt"
	"log"
	"net/http"
	"testing"

	"github.com/golang/oauth2"
)

// TODO(jbd): Remove after Go 1.4.
// Related to https://codereview.appspot.com/107320046
func TestA(t *testing.T) {}

func Example_regular() {
	opts, err := oauth2.New(
		oauth2.Client("YOUR_CLIENT_ID", "YOUR_CLIENT_SECRET"),
		oauth2.RedirectURL("YOUR_REDIRECT_URL"),
		oauth2.Scope("SCOPE1", "SCOPE2"),
		oauth2.Endpoint(
			"https://provider.com/o/oauth2/auth",
			"https://provider.com/o/oauth2/token",
		),
	)
	if err != nil {
		log.Fatal(err)
	}

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	url := opts.AuthCodeURL("state", "online", "auto")
	fmt.Printf("Visit the URL for the auth dialog: %v", url)

	// Use the authorization code that is pushed to the redirect URL.
	// NewTransportWithCode will do the handshake to retrieve
	// an access token and initiate a Transport that is
	// authorized and authenticated by the retrieved token.
	var code string
	if _, err = fmt.Scan(&code); err != nil {
		log.Fatal(err)
	}
	t, err := opts.NewTransportFromCode(code)
	if err != nil {
		log.Fatal(err)
	}

	// You can use t to initiate a new http.Client and
	// start making authenticated requests.
	client := http.Client{Transport: t}
	client.Get("...")
}

func Example_jWT() {
	opts, err := oauth2.New(
		// The contents of your RSA private key or your PEM file
		// that contains a private key.
		// If you have a p12 file instead, you
		// can use `openssl` to export the private key into a pem file.
		//
		//    $ openssl pkcs12 -in key.p12 -out key.pem -nodes
		//
		// It only supports PEM containers with no passphrase.
		oauth2.JWTClient(
			"xxx@developer.gserviceaccount.com",
			[]byte("-----BEGIN RSA PRIVATE KEY-----...")),
		oauth2.Scope("SCOPE1", "SCOPE2"),
		oauth2.JWTEndpoint("https://provider.com/o/oauth2/token"),
		// If you would like to impersonate a user, you can
		// create a transport with a subject. The following GET
		// request will be made on the behalf of user@example.com.
		// Subject is optional.
		oauth2.Subject("user@example.com"),
	)
	if err != nil {
		log.Fatal(err)
	}

	// Initiate an http.Client, the following GET request will be
	// authorized and authenticated on the behalf of user@example.com.
	client := http.Client{Transport: opts.NewTransport()}
	client.Get("...")
}
