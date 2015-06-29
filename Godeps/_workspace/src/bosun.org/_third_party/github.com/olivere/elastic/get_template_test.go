// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestGetPutDeleteTemplate(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// This is a search template, not an index template!
	tmpl := `{
	"template": {
		"query" : { "term" : { "{{my_field}}" : "{{my_value}}" } },
		"size"  : "{{my_size}}"
	},
	"params":{
		"my_field" : "user",
		"my_value" : "olivere",
		"my_size" : 5
	}
}`
	putres, err := client.PutTemplate().Id("elastic-template").BodyString(tmpl).Do()
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if putres == nil {
		t.Fatalf("expected response; got: %v", putres)
	}
	if !putres.Created {
		t.Fatalf("expected template to be created; got: %v", putres.Created)
	}

	// Always delete template
	defer client.DeleteTemplate().Id("elastic-template").Do()

	// Get template
	getres, err := client.GetTemplate().Id("elastic-template").Do()
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if getres == nil {
		t.Fatalf("expected response; got: %v", getres)
	}
	if getres.Template == "" {
		t.Errorf("expected template %q; got: %q", tmpl, getres.Template)
	}
}
