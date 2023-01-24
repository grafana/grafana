package util

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestPrependSlice(t *testing.T) {
	input := []int{1, 2, 3, 4, 5}

	if diff := cmp.Diff([]int{42, 1, 2, 3, 4, 5}, Prepend(input, 42)); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]int{42, 43, 1, 2, 3, 4, 5}, Prepend(input, 42, 43)); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]int{42}, Prepend(nil, 42)); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff([]int{42}, Prepend([]int{}, 42)); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}
