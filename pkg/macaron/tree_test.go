// Copyright 2015 The Macaron Authors
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
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_getWildcards(t *testing.T) {
	type result struct {
		pattern   string
		wildcards string
	}
	cases := map[string]result{
		"admin":                             {"admin", ""},
		":id":                               {"(.+)", ":id"},
		":id:int":                           {"([0-9]+)", ":id"},
		":id([0-9]+)":                       {"([0-9]+)", ":id"},
		":id([0-9]+)_:name":                 {"([0-9]+)_(.+)", ":id :name"},
		"article_:id_:page.html":            {"article_(.+)_(.+).html", ":id :page"},
		"article_:id:int_:page:string.html": {"article_([0-9]+)_([\\w]+).html", ":id :page"},
		"*":                                 {"*", ""},
		"*.*":                               {"*.*", ""},
	}
	Convey("Get wildcards", t, func() {
		for key, result := range cases {
			pattern, wildcards := getWildcards(key)
			So(pattern, ShouldEqual, result.pattern)
			So(strings.Join(wildcards, " "), ShouldEqual, result.wildcards)
		}
	})
}

func Test_getRawPattern(t *testing.T) {
	cases := map[string]string{
		"admin":                                  "admin",
		":id":                                    ":id",
		":id:int":                                ":id",
		":id([0-9]+)":                            ":id",
		":id([0-9]+)_:name":                      ":id_:name",
		"article_:id_:page.html":                 "article_:id_:page.html",
		"article_:id:int_:page:string.html":      "article_:id_:page.html",
		"article_:id([0-9]+)_:page([\\w]+).html": "article_:id_:page.html",
		"*":                                      "*",
		"*.*":                                    "*.*",
	}
	Convey("Get raw pattern", t, func() {
		for k, v := range cases {
			So(getRawPattern(k), ShouldEqual, v)
		}
	})
}

func Test_Tree_Match(t *testing.T) {
	Convey("Match route in tree", t, func() {
		Convey("Match static routes", func() {
			t := NewTree()
			So(t.Add("/", nil), ShouldNotBeNil)
			So(t.Add("/user", nil), ShouldNotBeNil)
			So(t.Add("/user/unknwon", nil), ShouldNotBeNil)
			So(t.Add("/user/unknwon/profile", nil), ShouldNotBeNil)

			So(t.Add("/", nil), ShouldNotBeNil)

			_, _, ok := t.Match("/")
			So(ok, ShouldBeTrue)
			_, _, ok = t.Match("/user")
			So(ok, ShouldBeTrue)
			_, _, ok = t.Match("/user/unknwon")
			So(ok, ShouldBeTrue)
			_, _, ok = t.Match("/user/unknwon/profile")
			So(ok, ShouldBeTrue)

			_, _, ok = t.Match("/404")
			So(ok, ShouldBeFalse)
		})

		Convey("Match optional routes", func() {
			t := NewTree()
			So(t.Add("/?:user", nil), ShouldNotBeNil)
			So(t.Add("/user/?:name", nil), ShouldNotBeNil)
			So(t.Add("/user/list/?:page:int", nil), ShouldNotBeNil)

			_, params, ok := t.Match("/")
			So(ok, ShouldBeTrue)
			So(params[":user"], ShouldBeEmpty)
			_, params, ok = t.Match("/unknwon")
			So(ok, ShouldBeTrue)
			So(params[":user"], ShouldEqual, "unknwon")
			_, params, ok = t.Match("/hello%2Fworld")
			So(ok, ShouldBeTrue)
			So(params[":user"], ShouldEqual, "hello/world")

			_, params, ok = t.Match("/user")
			So(ok, ShouldBeTrue)
			So(params[":name"], ShouldBeEmpty)
			_, params, ok = t.Match("/user/unknwon")
			So(ok, ShouldBeTrue)
			So(params[":name"], ShouldEqual, "unknwon")
			_, params, ok = t.Match("/hello%20world")
			So(ok, ShouldBeTrue)
			So(params[":user"], ShouldEqual, "hello world")

			_, params, ok = t.Match("/user/list/")
			So(ok, ShouldBeTrue)
			So(params[":page"], ShouldBeEmpty)
			_, params, ok = t.Match("/user/list/123")
			So(ok, ShouldBeTrue)
			So(params[":page"], ShouldEqual, "123")
		})

		Convey("Match with regexp", func() {
			t := NewTree()
			So(t.Add("/v1/:year:int/6/23", nil), ShouldNotBeNil)
			So(t.Add("/v2/2015/:month:int/23", nil), ShouldNotBeNil)
			So(t.Add("/v3/2015/6/:day:int", nil), ShouldNotBeNil)

			_, params, ok := t.Match("/v1/2015/6/23")
			So(ok, ShouldBeTrue)
			So(MatchTest("/v1/:year:int/6/23", "/v1/2015/6/23"), ShouldBeTrue)
			So(params[":year"], ShouldEqual, "2015")
			_, _, ok = t.Match("/v1/year/6/23")
			So(ok, ShouldBeFalse)
			So(MatchTest("/v1/:year:int/6/23", "/v1/year/6/23"), ShouldBeFalse)

			_, params, ok = t.Match("/v2/2015/6/23")
			So(ok, ShouldBeTrue)
			So(params[":month"], ShouldEqual, "6")
			_, _, ok = t.Match("/v2/2015/month/23")
			So(ok, ShouldBeFalse)

			_, params, ok = t.Match("/v3/2015/6/23")
			So(ok, ShouldBeTrue)
			So(params[":day"], ShouldEqual, "23")
			_, _, ok = t.Match("/v2/2015/6/day")
			So(ok, ShouldBeFalse)

			So(t.Add("/v1/shop/cms_:id(.+)_:page(.+).html", nil), ShouldNotBeNil)
			So(t.Add("/v1/:v/cms/aaa_:id(.+)_:page(.+).html", nil), ShouldNotBeNil)
			So(t.Add("/v1/:v/cms_:id(.+)_:page(.+).html", nil), ShouldNotBeNil)
			So(t.Add("/v1/:v(.+)_cms/ttt_:id(.+)_:page:string.html", nil), ShouldNotBeNil)

			_, params, ok = t.Match("/v1/shop/cms_123_1.html")
			So(ok, ShouldBeTrue)
			So(params[":id"], ShouldEqual, "123")
			So(params[":page"], ShouldEqual, "1")

			_, params, ok = t.Match("/v1/2/cms/aaa_124_2.html")
			So(ok, ShouldBeTrue)
			So(params[":v"], ShouldEqual, "2")
			So(params[":id"], ShouldEqual, "124")
			So(params[":page"], ShouldEqual, "2")

			_, params, ok = t.Match("/v1/3/cms_125_3.html")
			So(ok, ShouldBeTrue)
			So(params[":v"], ShouldEqual, "3")
			So(params[":id"], ShouldEqual, "125")
			So(params[":page"], ShouldEqual, "3")

			_, params, ok = t.Match("/v1/4_cms/ttt_126_4.html")
			So(ok, ShouldBeTrue)
			So(params[":v"], ShouldEqual, "4")
			So(params[":id"], ShouldEqual, "126")
			So(params[":page"], ShouldEqual, "4")
		})

		Convey("Match with path and extension", func() {
			t := NewTree()
			So(t.Add("/*.*", nil), ShouldNotBeNil)
			So(t.Add("/docs/*.*", nil), ShouldNotBeNil)

			_, params, ok := t.Match("/profile.html")
			So(ok, ShouldBeTrue)
			So(params[":path"], ShouldEqual, "profile")
			So(params[":ext"], ShouldEqual, "html")

			_, params, ok = t.Match("/profile")
			So(ok, ShouldBeTrue)
			So(params[":path"], ShouldEqual, "profile")
			So(params[":ext"], ShouldBeEmpty)

			_, params, ok = t.Match("/docs/framework/manual.html")
			So(ok, ShouldBeTrue)
			So(params[":path"], ShouldEqual, "framework/manual")
			So(params[":ext"], ShouldEqual, "html")

			_, params, ok = t.Match("/docs/framework/manual")
			So(ok, ShouldBeTrue)
			So(params[":path"], ShouldEqual, "framework/manual")
			So(params[":ext"], ShouldBeEmpty)
		})

		Convey("Match all", func() {
			t := NewTree()
			So(t.Add("/*", nil), ShouldNotBeNil)
			So(t.Add("/*/123", nil), ShouldNotBeNil)
			So(t.Add("/*/123/*", nil), ShouldNotBeNil)
			So(t.Add("/*/*/123", nil), ShouldNotBeNil)

			_, params, ok := t.Match("/1/2/3")
			So(ok, ShouldBeTrue)
			So(params["*0"], ShouldEqual, "1/2/3")

			_, params, ok = t.Match("/4/123")
			So(ok, ShouldBeTrue)
			So(params["*0"], ShouldEqual, "4")

			_, params, ok = t.Match("/5/123/6")
			So(ok, ShouldBeTrue)
			So(params["*0"], ShouldEqual, "5")
			So(params["*1"], ShouldEqual, "6")

			_, params, ok = t.Match("/7/8/123")
			So(ok, ShouldBeTrue)
			So(params["*0"], ShouldEqual, "7")
			So(params["*1"], ShouldEqual, "8")
		})

		Convey("Complex tests", func() {
			t := NewTree()
			So(t.Add("/:username/:reponame/commit/*", nil), ShouldNotBeNil)

			_, params, ok := t.Match("/unknwon/com/commit/d855b6c9dea98c619925b7b112f3c4e64b17bfa8")
			So(ok, ShouldBeTrue)
			So(params["*"], ShouldEqual, "d855b6c9dea98c619925b7b112f3c4e64b17bfa8")
		})
	})
}
