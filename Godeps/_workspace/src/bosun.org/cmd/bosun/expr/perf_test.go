package expr

import (
	"fmt"
	"testing"

	"bosun.org/opentsdb"
)

func TestSlowUnion(t *testing.T) {
	ra, rb := buildFakeResults()
	e := State{}
	e.unjoinedOk = true
	x := e.union(ra, rb, "")
	if len(x) != 1000 {
		t.Errorf("Bad length %d != 1000", len(x))
	}
}

func buildFakeResults() (ra, rb *Results) {
	ra = &Results{}
	rb = &Results{}
	for i := 0; i < 50000; i++ {
		tags := opentsdb.TagSet{}
		tags["disk"] = fmt.Sprint("a", i)
		tags["host"] = fmt.Sprint("b", i)
		if i < 1000 {
			ra.Results = append(ra.Results, &Result{Value: Number(0), Group: tags})
		}
		rb.Results = append(ra.Results, &Result{Value: Number(0), Group: tags})
	}
	return ra, rb
}

func BenchmarkSlowUnion(b *testing.B) {
	e := State{}
	e.unjoinedOk = true
	ra, rb := buildFakeResults()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		e.union(ra, rb, "")
	}
}
