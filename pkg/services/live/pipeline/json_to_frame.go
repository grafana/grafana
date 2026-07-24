package pipeline

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

type doc struct {
	path       []string
	iterator   *jsoniter.Iterator
	fields     []*data.Field
	fieldNames map[string]struct{}
	fieldTips  map[string]Field
}

func (d *doc) next() error {
	switch d.iterator.WhatIsNext() {
	case jsoniter.StringValue:
		d.addString(d.iterator.ReadString())
	case jsoniter.NumberValue:
		d.addNumber(d.iterator.ReadFloat64())
	case jsoniter.BoolValue:
		d.addBool(d.iterator.ReadBool())
	case jsoniter.NilValue:
		d.addNil()
		d.iterator.ReadNil()
	case jsoniter.ArrayValue:
		index := 0
		size := len(d.path)
		for d.iterator.ReadArray() {
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
		for fname := d.iterator.ReadObject(); fname != ""; fname = d.iterator.ReadObject() {
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
	f.Name = d.key()
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addNumber(v float64) {
	f := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 1)
	f.Name = d.key()
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addBool(v bool) {
	f := data.NewFieldFromFieldType(data.FieldTypeNullableBool, 1)
	f.Name = d.key()
	f.SetConcrete(0, v)
	d.fields = append(d.fields, f)
	d.fieldNames[d.key()] = struct{}{}
}

func (d *doc) addNil() {
	if tip, ok := d.fieldTips[d.key()]; ok {
		f := data.NewFieldFromFieldType(tip.Type, 1)
		f.Name = d.key()
		f.Set(0, nil)
		d.fields = append(d.fields, f)
		d.fieldNames[d.key()] = struct{}{}
	} else {
		logger.Warn("Skip nil field", "key", d.key())
	}
}

func jsonDocToFrame(name string, body []byte, fields map[string]Field, nowTimeFunc func() time.Time) (*data.Frame, error) {
	d := doc{
		iterator:   jsoniter.ParseBytes(jsoniter.ConfigDefault, body),
		path:       make([]string, 0),
		fieldTips:  fields,
		fieldNames: map[string]struct{}{},
	}

	f := data.NewFieldFromFieldType(data.FieldTypeTime, 1)
	f.Name = "Time"
	f.Set(0, nowTimeFunc())
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
