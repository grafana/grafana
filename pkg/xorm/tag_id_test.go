// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"xorm.io/core"
)

type IDGonicMapper struct {
	ID int64
}

func TestGonicMapperID(t *testing.T) {
	assert.NoError(t, prepareEngine())

	oldMapper := testEngine.GetColumnMapper()
	testEngine.UnMapType(rValue(new(IDGonicMapper)).Type())
	testEngine.SetMapper(core.LintGonicMapper)
	defer func() {
		testEngine.UnMapType(rValue(new(IDGonicMapper)).Type())
		testEngine.SetMapper(oldMapper)
	}()

	err := testEngine.CreateTables(new(IDGonicMapper))
	if err != nil {
		t.Fatal(err)
	}

	tables, err := testEngine.DBMetas()
	if err != nil {
		t.Fatal(err)
	}

	for _, tb := range tables {
		if tb.Name == "id_gonic_mapper" {
			if len(tb.PKColumns()) != 1 || tb.PKColumns()[0].Name != "id" {
				t.Fatal(tb)
			}
			return
		}
	}

	t.Fatal("not table id_gonic_mapper")
}

type IDSameMapper struct {
	ID int64
}

func TestSameMapperID(t *testing.T) {
	assert.NoError(t, prepareEngine())

	oldMapper := testEngine.GetColumnMapper()
	testEngine.UnMapType(rValue(new(IDSameMapper)).Type())
	testEngine.SetMapper(core.SameMapper{})
	defer func() {
		testEngine.UnMapType(rValue(new(IDSameMapper)).Type())
		testEngine.SetMapper(oldMapper)
	}()

	err := testEngine.CreateTables(new(IDSameMapper))
	if err != nil {
		t.Fatal(err)
	}

	tables, err := testEngine.DBMetas()
	if err != nil {
		t.Fatal(err)
	}

	for _, tb := range tables {
		if tb.Name == "IDSameMapper" {
			if len(tb.PKColumns()) != 1 || tb.PKColumns()[0].Name != "ID" {
				t.Fatalf("tb %s tb.PKColumns() is %d not 1, tb.PKColumns()[0].Name is %s not ID", tb.Name, len(tb.PKColumns()), tb.PKColumns()[0].Name)
			}
			return
		}
	}
	t.Fatal("not table IDSameMapper")
}
