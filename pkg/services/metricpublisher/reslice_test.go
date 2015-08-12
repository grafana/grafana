package metricpublisher

import (
	"fmt"
	"testing"

	"github.com/davecgh/go-spew/spew"
	m "github.com/grafana/grafana/pkg/models"
)

type testCase struct {
	inSize  int
	subSize int
}

func TestReslice(t *testing.T) {
	cases := []testCase{
		{10, 1},
		{10, 2},
		{10, 3},
		{10, 4},
		{10, 5},
		{10, 6},
		{10, 7},
		{10, 8},
		{10, 9},
		{10, 10},
		{10, 11},
		{100, 1},
		{100, 13},
		{100, 39},
		{100, 74},
		{100, 143},
		{100, 5000},
	}
	for _, c := range cases {
		in := make([]*m.MetricDefinition, c.inSize)
		for i := 0; i < c.inSize; i++ {
			in[i] = &m.MetricDefinition{OrgId: int64(i)}
		}
		out := Reslice(in, c.subSize)
		expectedLen := len(in) / c.subSize
		fullSubSlices := len(in) / c.subSize
		if len(in)%c.subSize != 0 {
			expectedLen += 1
		}
		if len(out) != expectedLen {
			spew.Dump(in)
			fmt.Println("========")
			spew.Dump(out)
			fmt.Println(c)
			t.Fatalf("out array len expected %d, got %d", expectedLen, len(out))
		}
		for i := 0; i < fullSubSlices; i++ {
			if len(out[i]) != c.subSize {
				t.Fatalf("out sub array %d len expected %d, got %d", i, c.subSize, len(out[i]))
			}
		}
		lastSize := len(in) % c.subSize
		if lastSize == 0 {
			lastSize = c.subSize
		}
		if len(out[len(out)-1]) != lastSize {
			t.Fatalf("out last sub array len expected %d, got %d", lastSize, len(out[len(out)-1]))
		}
		for i := 0; i < len(in); i++ {
			subArray := i / c.subSize
			subI := i % c.subSize
			if in[i] != out[subArray][subI] {
				t.Fatalf("element mismatch. in: %v, out: %v", in[i], out[subArray][subI])
			}
		}
	}
}
