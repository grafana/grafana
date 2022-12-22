// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package core

import (
	"reflect"
	"testing"
)

func TestPK(t *testing.T) {
	p := NewPK(1, 3, "string")
	str, err := p.ToString()
	if err != nil {
		t.Error(err)
	}
	t.Log(str)

	s := &PK{}
	err = s.FromString(str)
	if err != nil {
		t.Error(err)
	}
	t.Log(s)

	if len(*p) != len(*s) {
		t.Fatal("p", *p, "should be equal", *s)
	}

	for i, ori := range *p {
		if ori != (*s)[i] {
			t.Fatal("ori", ori, reflect.ValueOf(ori), "should be equal", (*s)[i], reflect.ValueOf((*s)[i]))
		}
	}
}
