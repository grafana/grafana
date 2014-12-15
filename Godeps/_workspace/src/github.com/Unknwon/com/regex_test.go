// Copyright 2013 com authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package com

import (
	"testing"
)

func TestIsEmail(t *testing.T) {
	emails := map[string]bool{
		`test@example.com`:             true,
		`single-character@b.org`:       true,
		`uncommon_address@test.museum`: true,
		`local@sld.UPPER`:              true,
		`@missing.org`:                 false,
		`missing@.com`:                 false,
		`missing@qq.`:                  false,
		`wrong-ip@127.1.1.1.26`:        false,
	}
	for e, r := range emails {
		b := IsEmail(e)
		if b != r {
			t.Errorf("IsEmail:\n Expect => %v\n Got => %v\n", r, b)
		}
	}
}

func TestIsUrl(t *testing.T) {
	urls := map[string]bool{
		"http://www.example.com":                     true,
		"http://example.com":                         true,
		"http://example.com?user=test&password=test": true,
		"http://example.com?user=test#login":         true,
		"ftp://example.com":                          true,
		"https://example.com":                        true,
		"htp://example.com":                          false,
		"http//example.com":                          false,
		"http://example":                             true,
	}
	for u, r := range urls {
		b := IsUrl(u)
		if b != r {
			t.Errorf("IsUrl:\n Expect => %v\n Got => %v\n", r, b)
		}
	}
}

func BenchmarkIsEmail(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsEmail("test@example.com")
	}
}

func BenchmarkIsUrl(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsEmail("http://example.com")
	}
}
