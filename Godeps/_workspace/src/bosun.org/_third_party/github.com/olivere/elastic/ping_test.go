// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/http"
	"testing"
)

func TestPingGet(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	res, code, err := client.Ping().Do()
	if err != nil {
		t.Fatal(err)
	}
	if code != http.StatusOK {
		t.Errorf("expected status code = %d; got %d", http.StatusOK, code)
	}
	if res == nil {
		t.Fatalf("expected to return result, got: %v", res)
	}
	if res.Status != http.StatusOK {
		t.Errorf("expected Status = %d; got %d", http.StatusOK, res.Status)
	}
	if res.Name == "" {
		t.Errorf("expected Name != \"\"; got %q", res.Name)
	}
	if res.Version.Number == "" {
		t.Errorf("expected Version.Number != \"\"; got %q", res.Version.Number)
	}
}

func TestPingHead(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	res, code, err := client.Ping().HttpHeadOnly(true).Do()
	if err != nil {
		t.Fatal(err)
	}
	if code != http.StatusOK {
		t.Errorf("expected status code = %d; got %d", http.StatusOK, code)
	}
	if res != nil {
		t.Errorf("expected not to return result, got: %v", res)
	}
}

func TestPingHeadFailure(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	res, code, err := client.Ping().
		URL("http://127.0.0.1:9299").
		HttpHeadOnly(true).
		Do()
	if err == nil {
		t.Error("expected error, got nil")
	}
	if code == http.StatusOK {
		t.Errorf("expected status code != %d; got %d", http.StatusOK, code)
	}
	if res != nil {
		t.Errorf("expected not to return result, got: %v", res)
	}
}
