// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"reflect"
	"testing"
)

func TestCanonicalize(t *testing.T) {
	tests := []struct {
		Input  []string
		Output []string
	}{
		{
			Input:  []string{"http://127.0.0.1/"},
			Output: []string{"http://127.0.0.1"},
		},
		{
			Input:  []string{"http://127.0.0.1:9200/", "gopher://golang.org/", "http://127.0.0.1:9201"},
			Output: []string{"http://127.0.0.1:9200", "http://127.0.0.1:9201"},
		},
		{
			Input:  []string{"http://user:secret@127.0.0.1/path?query=1#fragment"},
			Output: []string{"http://user:secret@127.0.0.1"},
		},
		{
			Input:  []string{"https://somewhere.on.mars:9999/path?query=1#fragment"},
			Output: []string{"https://somewhere.on.mars:9999"},
		},
	}

	for _, test := range tests {
		got := canonicalize(test.Input...)
		if !reflect.DeepEqual(got, test.Output) {
			t.Errorf("expected %v; got: %v", test.Output, got)
		}
	}
}
