// Copyright 2014 The oauth2 Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build appenginevm !appengine

package google_test

import (
	"fmt"
	"log"
	"net/http"
	"testing"

	"github.com/golang/oauth2"
	"github.com/golang/oauth2/google"
	"google.golang.org/appengine"
)

// Remove after Go 1.4.
// Related to https://codereview.appspot.com/107320046
func TestA(t *testing.T) {}

func Example_webServer() {
	// Your credentials should be obtained from the Google
	// Developer Console (https://console.developers.google.com).
	opts, err := oauth2.New(
		oauth2.Client("YOUR_CLIENT_ID", "YOUR_CLIENT_SECRET"),
		oauth2.RedirectURL("YOUR_REDIRECT_URL"),
		oauth2.Scope(
			"https://www.googleapis.com/auth/bigquery",
			"https://www.googleapis.com/auth/blogger",
		),
		google.Endpoint(),
	)
	if err != nil {
		log.Fatal(err)
	}
	// Redirect user to Google's consent page to ask for permission
	// for the scopes specified above.
	url := opts.AuthCodeURL("state", "online", "auto")
	fmt.Printf("Visit the URL for the auth dialog: %v", url)

	// Handle the exchange code to initiate a transport
	t, err := opts.NewTransportFromCode("exchange-code")
	if err != nil {
		log.Fatal(err)
	}
	client := http.Client{Transport: t}
	client.Get("...")
}

func Example_serviceAccountsJSON() {
	// Your credentials should be obtained from the Google
	// Developer Console (https://console.developers.google.com).
	// Navigate to your project, then see the "Credentials" page
	// under "APIs & Auth".
	// To create a service account client, click "Create new Client ID",
	// select "Service Account", and click "Create Client ID". A JSON
	// key file will then be downloaded to your computer.
	opts, err := oauth2.New(
		google.ServiceAccountJSONKey("/path/to/your-project-key.json"),
		oauth2.Scope(
			"https://www.googleapis.com/auth/bigquery",
			"https://www.googleapis.com/auth/blogger",
		),
	)
	if err != nil {
		log.Fatal(err)
	}
	// Initiate an http.Client. The following GET request will be
	// authorized and authenticated on the behalf of
	// your service account.
	client := http.Client{Transport: opts.NewTransport()}
	client.Get("...")
}

func Example_serviceAccounts() {
	// Your credentials should be obtained from the Google
	// Developer Console (https://console.developers.google.com).
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
		oauth2.Scope(
			"https://www.googleapis.com/auth/bigquery",
			"https://www.googleapis.com/auth/blogger",
		),
		google.JWTEndpoint(),
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

func Example_appEngine() {
	ctx := appengine.NewContext(nil)
	opts, err := oauth2.New(
		google.AppEngineContext(ctx),
		oauth2.Scope(
			"https://www.googleapis.com/auth/bigquery",
			"https://www.googleapis.com/auth/blogger",
		),
	)
	if err != nil {
		log.Fatal(err)
	}
	// The following client will be authorized by the App Engine
	// app's service account for the provided scopes.
	client := http.Client{Transport: opts.NewTransport()}
	client.Get("...")
}

func Example_computeEngine() {
	opts, err := oauth2.New(
		// Query Google Compute Engine's metadata server to retrieve
		// an access token for the provided account.
		// If no account is specified, "default" is used.
		google.ComputeEngineAccount(""),
	)
	if err != nil {
		log.Fatal(err)
	}
	client := http.Client{Transport: opts.NewTransport()}
	client.Get("...")
}
