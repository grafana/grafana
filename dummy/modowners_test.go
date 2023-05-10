package main

import "testing"

func TestCommonElement(t *testing.T) {
	for _, test := range []struct {
		A      []string
		B      []string
		Result bool
	}{
		{nil, nil, false},
		{[]string{"a"}, []string{"a"}, true},
		{[]string{"a", "b"}, []string{"a"}, true},
		{[]string{"a"}, []string{"b"}, false},
	} {
		if hasCommonElement(test.A, test.B) != test.Result {
			t.Error(test)
		}
	}
}
