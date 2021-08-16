package pipeline

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

type doc struct {
	path []string
	iter *jsoniter.Iterator

	fields     []*data.Field
	fieldNames map[string]struct{}
	fieldTips  map[string]Field
}

func (d *doc) next() error {
	switch d.iter.WhatIsNext() {
	case jsoniter.StringValue:
		d.addString(d.iter.ReadString())
	case jsoniter.NumberValue:
		d.addNumber(d.iter.ReadFloat64())
	case jsoniter.BoolValue:
		d.addBool(d.iter.ReadBool())
	case jsoniter.NilValue:
		d.addNil()
		d.iter.ReadNil()
	case jsoniter.ArrayValue:
		index := 0
		size := len(d.path)
		for d.iter.ReadArray() {
			d.path = append(d.path, fmt.Sprintf("[%d]", index))
			err := d.next()
			if err != nil {
				return err
			}
			d.path = d.path[:size]
			index++
		}
	case jsoniter.ObjectValue:
		size := len(d.path)
		for fname := d.iter.ReadObject(); fname != ""; fname = d.iter.ReadObject() {
			if size > 0 {
				d.path = append(d.path, ".")
			}
			d.path = append(d.path, fname)
			err := d.next()
			if err != nil {
				return err
			}
			d.path = d.path[:size]
		}
	case jsoniter.InvalidValue:
		return fmt.Errorf("invalid value")
	}
	return nil
}

func (d *doc) key() string {
	return strings.Join(d.path, "")
}

func (d *doc) addString(v string) {
	f := data.NewFieldFromFieldType(data.FieldTypeNullableString, 1)
	f.Name = d.key() // labels?
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addNumber(v float64) {
	f := data.NewFieldFromFieldType(data.FieldTypeFloat64, 1)
	f.Name = d.key() // labels?
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addBool(v bool) {
	f := data.NewFieldFromFieldType(data.FieldTypeNullableBool, 1)
	f.Name = d.key() // labels?
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addNil() {
	if tip, ok := d.fieldTips[d.key()]; ok {
		f := data.NewFieldFromFieldType(tip.Type, 1)
		f.Name = d.key() // labels?
		f.Set(0, nil)
		d.fields = append(d.fields, f)
		d.fieldNames[d.key()] = struct{}{}
	} else {
		logger.Warn("Skip nil field", "key", d.key())
	}
}

func JSONDocToFrame(name string, body []byte, fields map[string]Field) (*data.Frame, error) {
	d := doc{
		iter:       jsoniter.ParseBytes(jsoniter.ConfigDefault, body),
		path:       make([]string, 0),
		fieldTips:  fields,
		fieldNames: map[string]struct{}{},
	}

	f := data.NewFieldFromFieldType(data.FieldTypeTime, 1)
	f.Set(0, time.Now())
	d.fields = append(d.fields, f)

	err := d.next()
	if err != nil {
		return nil, err
	}

	if len(d.fields) < 2 {
		return nil, fmt.Errorf("no fields found")
	}

	for name, tip := range fields {
		if _, ok := d.fieldNames[name]; ok {
			continue
		}
		f := data.NewFieldFromFieldType(tip.Type, 1)
		f.Name = name
		f.Set(0, nil)
		f.Config = tip.Config
		d.fields = append(d.fields, f)
	}

	return data.NewFrame(name, d.fields...), nil
}
