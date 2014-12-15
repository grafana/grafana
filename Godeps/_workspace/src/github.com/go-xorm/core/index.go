package core

import (
	"sort"
)

const (
	IndexType = iota + 1
	UniqueType
)

// database index
type Index struct {
	Name string
	Type int
	Cols []string
}

// add columns which will be composite index
func (index *Index) AddColumn(cols ...string) {
	for _, col := range cols {
		index.Cols = append(index.Cols, col)
	}
}

func (index *Index) Equal(dst *Index) bool {
	if len(index.Cols) != len(dst.Cols) {
		return false
	}
	sort.StringSlice(index.Cols).Sort()
	sort.StringSlice(dst.Cols).Sort()

	for i := 0; i < len(index.Cols); i++ {
		if index.Cols[i] != dst.Cols[i] {
			return false
		}
	}
	return true
}

// new an index
func NewIndex(name string, indexType int) *Index {
	return &Index{name, indexType, make([]string, 0)}
}
