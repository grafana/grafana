package jsonitere

import j "github.com/json-iterator/go"

type Iterator struct {
	*j.Iterator
}

func NewIterator(i *j.Iterator) *Iterator {
	return &Iterator{i}
}

func (iter *Iterator) Read() (interface{}, error) {
	return iter.Iterator.Read(), iter.Error
}

func (iter *Iterator) ReadAny() (j.Any, error) {
	// Clear iter.Error?
	return iter.Iterator.ReadAny(), iter.Error
}

func (iter *Iterator) ReadArray() (bool, error) {
	return iter.Iterator.ReadArray(), iter.Error
}
