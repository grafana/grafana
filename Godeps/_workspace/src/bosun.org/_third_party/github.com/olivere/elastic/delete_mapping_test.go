// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestDeleteMappingURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Types    []string
		Expected string
	}{
		{
			[]string{"twitter"},
			[]string{"tweet"},
			"/twitter/_mapping/tweet",
		},
		{
			[]string{"store-1", "store-2"},
			[]string{"tweet", "user"},
			"/store-1%2Cstore-2/_mapping/tweet%2Cuser",
		},
	}

	for _, test := range tests {
		path, _, err := client.DeleteMapping().Index(test.Indices...).Type(test.Types...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}
