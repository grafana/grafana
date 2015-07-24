// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestIndexGetSettingsURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Names    []string
		Expected string
	}{
		{
			[]string{},
			[]string{},
			"/_all/_settings",
		},
		{
			[]string{},
			[]string{"index.merge.*"},
			"/_all/_settings/index.merge.%2A",
		},
		{
			[]string{"twitter-*"},
			[]string{"index.merge.*", "_settings"},
			"/twitter-%2A/_settings/index.merge.%2A%2C_settings",
		},
		{
			[]string{"store-1", "store-2"},
			[]string{"index.merge.*", "_settings"},
			"/store-1%2Cstore-2/_settings/index.merge.%2A%2C_settings",
		},
	}

	for _, test := range tests {
		path, _, err := client.IndexGetSettings().Index(test.Indices...).Name(test.Names...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestIndexGetSettingsService(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "1.4.0" {
		t.Skip("Index Get API is available since 1.4")
		return
	}

	res, err := client.IndexGetSettings().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatalf("expected result; got: %v", res)
	}
	info, found := res[testIndexName]
	if !found {
		t.Fatalf("expected index %q to be found; got: %v", testIndexName, found)
	}
	if info == nil {
		t.Fatalf("expected index %q to be != nil; got: %v", testIndexName, info)
	}
	if info.Settings == nil {
		t.Fatalf("expected index settings of %q to be != nil; got: %v", testIndexName, info.Settings)
	}
}
