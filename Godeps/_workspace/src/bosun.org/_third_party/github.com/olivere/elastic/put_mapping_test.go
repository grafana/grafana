// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestPutMappingURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Type     string
		Expected string
	}{
		{
			[]string{},
			"tweet",
			"/_mapping/tweet",
		},
		{
			[]string{"*"},
			"tweet",
			"/%2A/_mapping/tweet",
		},
		{
			[]string{"store-1", "store-2"},
			"tweet",
			"/store-1%2Cstore-2/_mapping/tweet",
		},
	}

	for _, test := range tests {
		path, _, err := client.PutMapping().Index(test.Indices...).Type(test.Type).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestMappingLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	mapping := `{
		"tweetdoc":{
			"properties":{
				"message":{
					"type":"string",
					"store":true
				}
			}
		}
	}`

	putresp, err := client.PutMapping().Index(testIndexName2).Type("tweetdoc").BodyString(mapping).Do()
	if err != nil {
		t.Fatalf("expected put mapping to succeed; got: %v", err)
	}
	if putresp == nil {
		t.Fatalf("expected put mapping response; got: %v", putresp)
	}
	if !putresp.Acknowledged {
		t.Fatalf("expected put mapping ack; got: %v", putresp.Acknowledged)
	}

	getresp, err := client.GetMapping().Index(testIndexName2).Type("tweetdoc").Do()
	if err != nil {
		t.Fatalf("expected get mapping to succeed; got: %v", err)
	}
	if getresp == nil {
		t.Fatalf("expected get mapping response; got: %v", getresp)
	}
	props, ok := getresp[testIndexName2]
	if !ok {
		t.Fatalf("expected JSON root to be of type map[string]interface{}; got: %#v", props)
	}

	delresp, err := client.DeleteMapping().Index(testIndexName2).Type("tweetdoc").Do()
	if err != nil {
		t.Fatalf("expected delete mapping to succeed; got: %v", err)
	}
	if delresp == nil {
		t.Fatalf("expected delete mapping response; got: %v", delresp)
	}
	if !delresp.Acknowledged {
		t.Fatalf("expected delete mapping ack; got: %v", delresp.Acknowledged)
	}
}
