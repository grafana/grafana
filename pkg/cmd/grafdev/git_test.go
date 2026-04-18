package main

import "testing"

func TestDefaultBranchFromLsRemoteSymrefOutput(t *testing.T) {
	t.Parallel()
	out := "ref: refs/heads/main\tHEAD\nabcdef123\tHEAD\n"
	got, err := defaultBranchFromLsRemoteSymrefOutput(out)
	if err != nil {
		t.Fatal(err)
	}
	if got != "main" {
		t.Fatalf("got %q want main", got)
	}
}

func TestDefaultBranchFromLsRemoteSymrefOutput_empty(t *testing.T) {
	t.Parallel()
	_, err := defaultBranchFromLsRemoteSymrefOutput("abcdef123\tHEAD\n")
	if err == nil {
		t.Fatal("expected error")
	}
}
