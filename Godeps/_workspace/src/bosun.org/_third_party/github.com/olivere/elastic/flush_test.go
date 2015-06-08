// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestFlush(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Flush all indices
	res, err := client.Flush().Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Errorf("expected res to be != nil; got: %v", res)
	}
}
