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

func TestIsLetter(t *testing.T) {
	if IsLetter('1') {
		t.Errorf("IsLetter:\n Expect => %v\n Got => %v\n", false, true)
	}

	if IsLetter('[') {
		t.Errorf("IsLetter:\n Expect => %v\n Got => %v\n", false, true)
	}

	if !IsLetter('a') {
		t.Errorf("IsLetter:\n Expect => %v\n Got => %v\n", true, false)
	}

	if !IsLetter('Z') {
		t.Errorf("IsLetter:\n Expect => %v\n Got => %v\n", true, false)
	}
}

func TestExpand(t *testing.T) {
	match := map[string]string{
		"domain":    "gowalker.org",
		"subdomain": "github.com",
	}
	s := "http://{domain}/{subdomain}/{0}/{1}"
	sR := "http://gowalker.org/github.com/Unknwon/gowalker"
	if Expand(s, match, "Unknwon", "gowalker") != sR {
		t.Errorf("Expand:\n Expect => %s\n Got => %s\n", sR, s)
	}
}

func TestReverse(t *testing.T) {
	if Reverse("abcdefg") != "gfedcba" {
		t.Errorf("Reverse:\n Except => %s\n Got =>%s\n", "gfedcba", Reverse("abcdefg"))
	}
	if Reverse("上善若水厚德载物") != "物载德厚水若善上" {
		t.Errorf("Reverse:\n Except => %s\n Got =>%s\n", "物载德厚水若善上", Reverse("上善若水厚德载物"))
	}
}

func BenchmarkIsLetter(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsLetter('a')
	}
}

func BenchmarkExpand(b *testing.B) {
	match := map[string]string{
		"domain":    "gowalker.org",
		"subdomain": "github.com",
	}
	s := "http://{domain}/{subdomain}/{0}/{1}"
	for i := 0; i < b.N; i++ {
		Expand(s, match, "Unknwon", "gowalker")
	}
}

func BenchmarkReverse(b *testing.B) {
	s := "abscef中文"
	for i := 0; i < b.N; i++ {
		Reverse(s)
	}
}
