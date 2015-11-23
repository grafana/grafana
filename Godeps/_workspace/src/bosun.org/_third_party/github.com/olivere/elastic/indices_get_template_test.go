// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestIndexGetTemplateURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Names    []string
		Expected string
	}{
		{
			[]string{},
			"/_template",
		},
		{
			[]string{"index1"},
			"/_template/index1",
		},
		{
			[]string{"index1", "index2"},
			"/_template/index1%2Cindex2",
		},
	}

	for _, test := range tests {
		path, _, err := client.IndexGetTemplate().Name(test.Names...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}
