// Copyright 2014 Unknwon
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

package macaron

import (
	// "net/http"
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_splitSegment(t *testing.T) {
	type result struct {
		Ok    bool
		Parts []string
		Regex string
	}
	cases := map[string]result{
		"admin":              result{false, nil, ""},
		":id":                result{true, []string{":id"}, ""},
		"?:id":               result{true, []string{":", ":id"}, ""},
		":id:int":            result{true, []string{":id"}, "([0-9]+)"},
		":name:string":       result{true, []string{":name"}, `([\w]+)`},
		":id([0-9]+)":        result{true, []string{":id"}, "([0-9]+)"},
		":id([0-9]+)_:name":  result{true, []string{":id", ":name"}, "([0-9]+)_(.+)"},
		"cms_:id_:page.html": result{true, []string{":id", ":page"}, "cms_(.+)_(.+).html"},
		"*":                  result{true, []string{":splat"}, ""},
		"*.*":                result{true, []string{".", ":path", ":ext"}, ""},
	}
	Convey("Splits segment into parts", t, func() {
		for key, result := range cases {
			ok, parts, regex := splitSegment(key)
			So(ok, ShouldEqual, result.Ok)
			if result.Parts == nil {
				So(parts, ShouldBeNil)
			} else {
				So(parts, ShouldNotBeNil)
				So(strings.Join(parts, " "), ShouldEqual, strings.Join(result.Parts, " "))
			}
			So(regex, ShouldEqual, result.Regex)
		}
	})
}

func Test_Tree_Match(t *testing.T) {
	type result struct {
		pattern string
		reqUrl  string
		params  map[string]string
	}

	cases := []result{
		{"/:id", "/123", map[string]string{":id": "123"}},
		{"/hello/?:id", "/hello", map[string]string{":id": ""}},
		{"/", "/", nil},
		{"", "", nil},
		{"/customer/login", "/customer/login", nil},
		{"/customer/login", "/customer/login.json", map[string]string{":ext": "json"}},
		{"/*", "/customer/123", map[string]string{":splat": "customer/123"}},
		{"/*", "/customer/2009/12/11", map[string]string{":splat": "customer/2009/12/11"}},
		{"/aa/*/bb", "/aa/2009/bb", map[string]string{":splat": "2009"}},
		{"/cc/*/dd", "/cc/2009/11/dd", map[string]string{":splat": "2009/11"}},
		{"/ee/:year/*/ff", "/ee/2009/11/ff", map[string]string{":year": "2009", ":splat": "11"}},
		{"/thumbnail/:size/uploads/*", "/thumbnail/100x100/uploads/items/2014/04/20/dPRCdChkUd651t1Hvs18.jpg",
			map[string]string{":size": "100x100", ":splat": "items/2014/04/20/dPRCdChkUd651t1Hvs18.jpg"}},
		{"/*.*", "/nice/api.json", map[string]string{":path": "nice/api", ":ext": "json"}},
		{"/:name/*.*", "/nice/api.json", map[string]string{":name": "nice", ":path": "api", ":ext": "json"}},
		{"/:name/test/*.*", "/nice/test/api.json", map[string]string{":name": "nice", ":path": "api", ":ext": "json"}},
		{"/dl/:width:int/:height:int/*.*", "/dl/48/48/05ac66d9bda00a3acf948c43e306fc9a.jpg",
			map[string]string{":width": "48", ":height": "48", ":ext": "jpg", ":path": "05ac66d9bda00a3acf948c43e306fc9a"}},
		{"/v1/shop/:id:int", "/v1/shop/123", map[string]string{":id": "123"}},
		{"/:year:int/:month:int/:id/:endid", "/1111/111/aaa/aaa", map[string]string{":year": "1111", ":month": "111", ":id": "aaa", ":endid": "aaa"}},
		{"/v1/shop/:id/:name", "/v1/shop/123/nike", map[string]string{":id": "123", ":name": "nike"}},
		{"/v1/shop/:id/account", "/v1/shop/123/account", map[string]string{":id": "123"}},
		{"/v1/shop/:name:string", "/v1/shop/nike", map[string]string{":name": "nike"}},
		{"/v1/shop/:id([0-9]+)", "/v1/shop//123", map[string]string{":id": "123"}},
		{"/v1/shop/:id([0-9]+)_:name", "/v1/shop/123_nike", map[string]string{":id": "123", ":name": "nike"}},
		{"/v1/shop/:id(.+)_cms.html", "/v1/shop/123_cms.html", map[string]string{":id": "123"}},
		{"/v1/shop/cms_:id(.+)_:page(.+).html", "/v1/shop/cms_123_1.html", map[string]string{":id": "123", ":page": "1"}},
		{"/v1/:v/cms/aaa_:id(.+)_:page(.+).html", "/v1/2/cms/aaa_123_1.html", map[string]string{":v": "2", ":id": "123", ":page": "1"}},
		{"/v1/:v/cms_:id(.+)_:page(.+).html", "/v1/2/cms_123_1.html", map[string]string{":v": "2", ":id": "123", ":page": "1"}},
		{"/v1/:v(.+)_cms/ttt_:id(.+)_:page(.+).html", "/v1/2_cms/ttt_123_1.html", map[string]string{":v": "2", ":id": "123", ":page": "1"}},
	}

	Convey("Match routers in tree", t, func() {
		for _, c := range cases {
			t := NewTree()
			t.AddRouter(c.pattern, nil)
			_, params := t.Match(c.reqUrl)
			if params != nil {
				for k, v := range c.params {
					vv, ok := params[k]
					So(ok, ShouldBeTrue)
					So(vv, ShouldEqual, v)
				}
			}
		}
	})
}
