// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

func trimQuote(s string) string {
	if len(s) == 0 {
		return s
	}

	if s[0] == '`' {
		s = s[1:]
	}
	if len(s) > 0 && s[len(s)-1] == '`' {
		return s[:len(s)-1]
	}
	return s
}
