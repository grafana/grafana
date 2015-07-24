// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestIndexGetURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Features []string
		Expected string
	}{
		{
			[]string{},
			[]string{},
			"/_all",
		},
		{
			[]string{},
			[]string{"_mappings"},
			"/_all/_mappings",
		},
		{
			[]string{"twitter"},
			[]string{"_mappings", "_settings"},
			"/twitter/_mappings%2C_settings",
		},
		{
			[]string{"store-1", "store-2"},
			[]string{"_mappings", "_settings"},
			"/store-1%2Cstore-2/_mappings%2C_settings",
		},
	}

	for _, test := range tests {
		path, _, err := client.IndexGet().Index(test.Indices...).Feature(test.Features...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestIndexGetService(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "1.4.0" {
		t.Skip("Index Get API is available since 1.4")
		return
	}

	res, err := client.IndexGet().Index(testIndexName).Do()
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
	if info.Mappings == nil {
		t.Errorf("expected mappings to be != nil; got: %v", info.Mappings)
	}
	if info.Settings == nil {
		t.Errorf("expected settings to be != nil; got: %v", info.Settings)
	}
}
