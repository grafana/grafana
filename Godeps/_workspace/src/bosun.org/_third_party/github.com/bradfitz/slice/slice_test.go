package slice

import (
	"math/rand"
	"reflect"
	"sort"
	"testing"
	"unsafe"
)

const nItem = 50000

type S struct {
	s string
	i int64
	p *int
	b byte
}

type lessCall struct {
	i, j int
	res  bool
}

type lessLogger struct {
	sort.Interface
	dst *[]lessCall
}

func (l lessLogger) Less(i, j int) bool {
	got := l.Interface.Less(i, j)
	*l.dst = append(*l.dst, lessCall{i, j, got})
	return got
}

func TestSwapMem(t *testing.T) {
	buf := []byte{
		1, 2, 3, 4,
		5, 6, 7, 8,
		0, 0, 0, 0,
	}
	const size = 4
	ms := newMemSwap(size, unsafe.Pointer(&buf[0]), unsafe.Pointer(&buf[8]))
	ms.Swap(0, 1)
	want := []byte{
		5, 6, 7, 8,
		1, 2, 3, 4,
		1, 2, 3, 4,
	}
	if !reflect.DeepEqual(buf, want) {
		t.Errorf("buf = %v; want %v", buf, want)
	}
}

func TestSort3(t *testing.T) {
	x := []int{3, 2, 1}
	var sawOutside, sawInside []lessCall
	si := SortInterface(x, func(i, j int) bool {
		ret := x[i] < x[j]
		sawInside = append(sawInside, lessCall{i, j, ret})
		return ret
	})
	sort.Sort(lessLogger{si, &sawOutside})
	want := []int{1, 2, 3}
	if !reflect.DeepEqual(x, want) {
		t.Errorf("bad Sort = %v; want %v", x, want)
	}
	if !reflect.DeepEqual(sawOutside, sawInside) {
		t.Errorf("assembly goo wrong. Inner func & outer interface saw different results:\nInner: %v\nOuter: %v\n", sawInside, sawOutside)
	}
}

func TestSort(t *testing.T) {
	rand.Seed(1)
	x := make([]int64, nItem)
	for i := range x {
		x[i] = int64(rand.Intn(nItem * 10))
	}
	x2 := append([]int64(nil), x...)

	Sort(x, func(i, j int) bool {
		return x[i] < x[j]
	})
	sort.Sort(Int64Slice(x2))
	if !reflect.DeepEqual(x, x2) {
		t.Errorf("sorting failed")
	}
}

func TestSortStruct(t *testing.T) {
	rand.Seed(1)
	x := make([]S, nItem)
	for i := range x {
		x[i] = S{i: int64(rand.Intn(nItem * 10))}
	}
	x2 := append([]S(nil), x...)

	Sort(x, func(i, j int) bool {
		return x[i].i < x[j].i
	})
	sort.Sort(SSlice(x2))
	if !reflect.DeepEqual(x, x2) {
		t.Errorf("sorting failed")
	}
}

func BenchmarkSortInt64New(b *testing.B) {
	rand.Seed(1)
	x := make([]int64, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = int64(rand.Intn(nItem * 10))
		}
		Sort(x, func(i, j int) bool {
			return x[i] < x[j]
		})
	}
}

func BenchmarkSortInt64Old(b *testing.B) {
	rand.Seed(1)
	x := make([]int64, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = int64(rand.Intn(nItem * 10))
		}
		sort.Sort(Int64Slice(x))
	}
}

func BenchmarkSortInt32New(b *testing.B) {
	rand.Seed(1)
	x := make([]int32, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = int32(rand.Intn(nItem * 10))
		}
		Sort(x, func(i, j int) bool {
			return x[i] < x[j]
		})
	}
}

func BenchmarkSortInt32Old(b *testing.B) {
	rand.Seed(1)
	x := make([]int32, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = int32(rand.Intn(nItem * 10))
		}
		sort.Sort(Int32Slice(x))
	}
}

func BenchmarkSortStructOld(b *testing.B) {
	rand.Seed(1)
	x := make([]S, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = S{i: int64(rand.Intn(nItem * 10))}
		}
		sort.Sort(SSlice(x))
	}
}

func BenchmarkSortStructNew(b *testing.B) {
	rand.Seed(1)
	x := make([]S, nItem)
	for i := 0; i < b.N; i++ {
		for j := range x {
			x[j] = S{i: int64(rand.Intn(nItem * 10))}
		}
		Sort(x, func(i, j int) bool {
			return x[i].i < x[j].i
		})
	}
}

// Int64Slice attaches the methods of sort.Interface to []int64, sorting in increasing order.
type Int64Slice []int64

func (s Int64Slice) Len() int           { return len(s) }
func (s Int64Slice) Less(i, j int) bool { return s[i] < s[j] }
func (s Int64Slice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

// Int32Slice attaches the methods of sort.Interface to []int32, sorting in increasing order.
type Int32Slice []int32

func (s Int32Slice) Len() int           { return len(s) }
func (s Int32Slice) Less(i, j int) bool { return s[i] < s[j] }
func (s Int32Slice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

type SSlice []S

func (s SSlice) Len() int           { return len(s) }
func (s SSlice) Less(i, j int) bool { return s[i].i < s[j].i }
func (s SSlice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
