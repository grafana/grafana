package util

import "testing"

func TestMd5Sum(t *testing.T) {
	input := "don't hash passwords with md5"

	have, err := Md5SumString(input)
	if err != nil {
		t.Fatal("expected err to be nil")
	}

	want := "dd1f7fdb3466c0d09c2e839d1f1530f8"
	if have != want {
		t.Fatalf("expected: %s got: %s", want, have)
	}
}
