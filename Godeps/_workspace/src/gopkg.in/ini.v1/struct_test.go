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

package ini

import (
	"strings"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

type testNested struct {
	Cities []string `delim:"|"`
	Visits []time.Time
	Note   string
	Unused int `ini:"-"`
}

type testEmbeded struct {
	GPA float64
}

type testStruct struct {
	Name         string `ini:"NAME"`
	Age          int
	Male         bool
	Money        float64
	Born         time.Time
	Others       testNested
	*testEmbeded `ini:"grade"`
	Unused       int `ini:"-"`
}

const _CONF_DATA_STRUCT = `
NAME = Unknwon
Age = 21
Male = true
Money = 1.25
Born = 1993-10-07T20:17:05Z

[Others]
Cities = HangZhou|Boston
Visits = 1993-10-07T20:17:05Z, 1993-10-07T20:17:05Z
Note = Hello world!

[grade]
GPA = 2.8
`

type unsupport struct {
	Byte byte
}

type unsupport2 struct {
	Others struct {
		Cities byte
	}
}

type unsupport3 struct {
	Cities byte
}

type unsupport4 struct {
	*unsupport3 `ini:"Others"`
}

type invalidInt struct {
	Age int
}

type invalidBool struct {
	Male bool
}

type invalidFloat struct {
	Money float64
}

type invalidTime struct {
	Born time.Time
}

type emptySlice struct {
	Cities []string
}

const _INVALID_DATA_CONF_STRUCT = `
Age = age
Male = 123
Money = money
Born = nil
Cities = 
`

func Test_Struct(t *testing.T) {
	Convey("Map file to struct", t, func() {
		ts := new(testStruct)
		So(MapTo(ts, []byte(_CONF_DATA_STRUCT)), ShouldBeNil)

		So(ts.Name, ShouldEqual, "Unknwon")
		So(ts.Age, ShouldEqual, 21)
		So(ts.Male, ShouldBeTrue)
		So(ts.Money, ShouldEqual, 1.25)

		t, err := time.Parse(time.RFC3339, "1993-10-07T20:17:05Z")
		So(err, ShouldBeNil)
		So(ts.Born.String(), ShouldEqual, t.String())

		So(strings.Join(ts.Others.Cities, ","), ShouldEqual, "HangZhou,Boston")
		So(ts.Others.Visits[0].String(), ShouldEqual, t.String())
		So(ts.Others.Note, ShouldEqual, "Hello world!")
		So(ts.testEmbeded.GPA, ShouldEqual, 2.8)
	})

	Convey("Map to non-pointer struct", t, func() {
		cfg, err := Load([]byte(_CONF_DATA_STRUCT))
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		So(cfg.MapTo(testStruct{}), ShouldNotBeNil)
	})

	Convey("Map to unsupported type", t, func() {
		cfg, err := Load([]byte(_CONF_DATA_STRUCT))
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		cfg.NameMapper = func(raw string) string {
			if raw == "Byte" {
				return "NAME"
			}
			return raw
		}
		So(cfg.MapTo(&unsupport{}), ShouldNotBeNil)
		So(cfg.MapTo(&unsupport2{}), ShouldNotBeNil)
		So(cfg.MapTo(&unsupport4{}), ShouldNotBeNil)
	})

	Convey("Map from invalid data source", t, func() {
		So(MapTo(&testStruct{}, "hi"), ShouldNotBeNil)
	})

	Convey("Map to wrong types", t, func() {
		So(MapTo(&invalidInt{}, []byte(_INVALID_DATA_CONF_STRUCT)), ShouldNotBeNil)
		So(MapTo(&invalidBool{}, []byte(_INVALID_DATA_CONF_STRUCT)), ShouldNotBeNil)
		So(MapTo(&invalidFloat{}, []byte(_INVALID_DATA_CONF_STRUCT)), ShouldNotBeNil)
		So(MapTo(&invalidTime{}, []byte(_INVALID_DATA_CONF_STRUCT)), ShouldNotBeNil)
		So(MapTo(&emptySlice{}, []byte(_INVALID_DATA_CONF_STRUCT)), ShouldBeNil)
	})
}

type testMapper struct {
	PackageName string
}

func Test_NameGetter(t *testing.T) {
	Convey("Test name mappers", t, func() {
		So(MapToWithMapper(&testMapper{}, TitleUnderscore, []byte("packag_name=ini")), ShouldBeNil)

		cfg, err := Load([]byte("PACKAGE_NAME=ini"))
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		cfg.NameMapper = AllCapsUnderscore
		tg := new(testMapper)
		So(cfg.MapTo(tg), ShouldBeNil)
		So(tg.PackageName, ShouldEqual, "ini")
	})
}
