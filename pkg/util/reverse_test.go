package util

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestReverse(t *testing.T) {
	input := []int{1, 2, 3, 4, 5}

	if diff := cmp.Diff([]int{5, 4, 3, 2, 1}, Reverse(input)); diff != "" {
		t.Errorf("Result mismatch (-want +got):\n%s", diff)
	}
}
