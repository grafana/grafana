// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "strings"

type columnMap []string

func (m columnMap) contain(colName string) bool {
	if len(m) == 0 {
		return false
	}

	n := len(colName)
	for _, mk := range m {
		if len(mk) != n {
			continue
		}
		if strings.EqualFold(mk, colName) {
			return true
		}
	}

	return false
}

func (m *columnMap) add(colName string) bool {
	if m.contain(colName) {
		return false
	}
	*m = append(*m, colName)
	return true
}
