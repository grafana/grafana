package util

import "testing"

func TestMd5Sum(t *testing.T) {
	input := "dont hash passwords with md5"

	have, err := Md5SumString(input)
	if err != nil {
		t.Fatal("expected err to be nil")
	}

	want := "2d6a56c82d09d374643b926d3417afba"
	if have != want {
		t.Fatalf("expected: %s got: %s", want, have)
	}
}
