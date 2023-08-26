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

func (iter *Iterator) ReadObject() (string, error) {
	return iter.Iterator.ReadObject(), iter.Error
}

func (iter *Iterator) ReadString() (string, error) {
	return iter.Iterator.ReadString(), iter.Error
}

func (iter *Iterator) WhatIsNext() (j.ValueType, error) {
	return iter.Iterator.WhatIsNext(), iter.Error
}

func (iter *Iterator) Skip() error {
	iter.Iterator.Skip()
	return iter.Error
}

func (iter *Iterator) ReadVal(obj interface{}) error {
	iter.Iterator.ReadVal(obj)
	return iter.Error
}

func (iter *Iterator) ReadFloat64() (float64, error) {
	return iter.Iterator.ReadFloat64(), iter.Error
}
