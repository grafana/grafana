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
	"fmt"
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

const _CONF_DATA = `
; Package name
NAME = ini
; Package version
VERSION = v1
; Package import path
IMPORT_PATH = gopkg.in/%(NAME)s.%(VERSION)s

# Information about package author
# Bio can be written in multiple lines.
[author]
NAME = Unknwon
E-MAIL = fake@localhost
GITHUB = https://github.com/%(NAME)s
BIO = """Gopher.
Coding addict.
Good man.
"""

[package]
CLONE_URL = https://%(IMPORT_PATH)s

[package.sub]
UNUSED_KEY = should be deleted

[features]
-: Support read/write comments of keys and sections
-: Support auto-increment of key names
-: Support load multiple files to overwrite key values

[types]
STRING = str
BOOL = true
FLOAT64 = 1.25
INT = 10

[array]
STRINGS = en, zh, de
FLOAT64S = 1.1, 2.2, 3.3
INTS = 1, 2, 3

[note]

[advance]
true = """"2+3=5""""
"1+1=2" = true
"""6+1=7""" = true
"""` + "`" + `5+5` + "`" + `""" = 10
""""6+6"""" = 12
` + "`" + `7-2=4` + "`" + ` = false
ADDRESS = ` + "`" + `404 road,
NotFound, State, 50000` + "`"

func Test_Load(t *testing.T) {
	Convey("Load from data sources", t, func() {

		Convey("Load with empty data", func() {
			cfg, err := Load([]byte(""))
			So(err, ShouldBeNil)
			So(cfg, ShouldNotBeNil)
		})

		Convey("Load with multiple data sources", func() {
			cfg, err := Load([]byte(_CONF_DATA), "testdata/conf.ini")
			So(err, ShouldBeNil)
			So(cfg, ShouldNotBeNil)
		})
	})

	Convey("Bad load process", t, func() {

		Convey("Load from invalid data sources", func() {
			_, err := Load(_CONF_DATA)
			So(err, ShouldNotBeNil)

			_, err = Load("testdata/404.ini")
			So(err, ShouldNotBeNil)

			_, err = Load(1)
			So(err, ShouldNotBeNil)

			_, err = Load([]byte(""), 1)
			So(err, ShouldNotBeNil)
		})

		Convey("Load with empty section name", func() {
			_, err := Load([]byte("[]"))
			So(err, ShouldNotBeNil)
		})

		Convey("Load with bad keys", func() {
			_, err := Load([]byte(`"""name`))
			So(err, ShouldNotBeNil)

			_, err = Load([]byte(`"""name"""`))
			So(err, ShouldNotBeNil)

			_, err = Load([]byte(`""=1`))
			So(err, ShouldNotBeNil)

			_, err = Load([]byte(`=`))
			So(err, ShouldNotBeNil)

			_, err = Load([]byte(`name`))
			So(err, ShouldNotBeNil)
		})

		Convey("Load with bad values", func() {
			_, err := Load([]byte(`name="""Unknwon`))
			So(err, ShouldNotBeNil)
		})
	})
}

func Test_Values(t *testing.T) {
	Convey("Test getting and setting values", t, func() {
		cfg, err := Load([]byte(_CONF_DATA), "testdata/conf.ini")
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		Convey("Get values in default section", func() {
			sec := cfg.Section("")
			So(sec, ShouldNotBeNil)
			So(sec.Key("NAME").Value(), ShouldEqual, "ini")
			So(sec.Key("NAME").String(), ShouldEqual, "ini")
			So(sec.Key("NAME").Comment, ShouldEqual, "; Package name")
			So(sec.Key("IMPORT_PATH").String(), ShouldEqual, "gopkg.in/ini.v1")
		})

		Convey("Get values in non-default section", func() {
			sec := cfg.Section("author")
			So(sec, ShouldNotBeNil)
			So(sec.Key("NAME").String(), ShouldEqual, "Unknwon")
			So(sec.Key("GITHUB").String(), ShouldEqual, "https://github.com/Unknwon")

			sec = cfg.Section("package")
			So(sec, ShouldNotBeNil)
			So(sec.Key("CLONE_URL").String(), ShouldEqual, "https://gopkg.in/ini.v1")
		})

		Convey("Get auto-increment key names", func() {
			keys := cfg.Section("features").Keys()
			for i, k := range keys {
				So(k.Name(), ShouldEqual, fmt.Sprintf("#%d", i+1))
			}
		})

		Convey("Get overwrite value", func() {
			So(cfg.Section("author").Key("E-MAIL").String(), ShouldEqual, "u@gogs.io")
		})

		Convey("Get sections", func() {
			sections := cfg.Sections()
			for i, name := range []string{DEFAULT_SECTION, "author", "package", "package.sub", "features", "types", "array", "note", "advance"} {
				So(sections[i].Name(), ShouldEqual, name)
			}
		})

		Convey("Get parent section value", func() {
			So(cfg.Section("package.sub").Key("CLONE_URL").String(), ShouldEqual, "https://gopkg.in/ini.v1")
		})

		Convey("Get multiple line value", func() {
			So(cfg.Section("author").Key("BIO").String(), ShouldEqual, "Gopher.\nCoding addict.\nGood man.\n")
		})

		Convey("Get values with type", func() {
			sec := cfg.Section("types")
			v1, err := sec.Key("BOOL").Bool()
			So(err, ShouldBeNil)
			So(v1, ShouldBeTrue)

			v2, err := sec.Key("FLOAT64").Float64()
			So(err, ShouldBeNil)
			So(v2, ShouldEqual, 1.25)

			v3, err := sec.Key("INT").Int()
			So(err, ShouldBeNil)
			So(v3, ShouldEqual, 10)

			v4, err := sec.Key("INT").Int64()
			So(err, ShouldBeNil)
			So(v4, ShouldEqual, 10)

			Convey("Must get values with type", func() {
				So(sec.Key("STRING").MustString("404"), ShouldEqual, "str")
				So(sec.Key("BOOL").MustBool(), ShouldBeTrue)
				So(sec.Key("FLOAT64").MustFloat64(), ShouldEqual, 1.25)
				So(sec.Key("INT").MustInt(), ShouldEqual, 10)
				So(sec.Key("INT").MustInt64(), ShouldEqual, 10)

				Convey("Must get values with default value", func() {
					So(sec.Key("STRING_404").MustString("404"), ShouldEqual, "404")
					So(sec.Key("BOOL_404").MustBool(true), ShouldBeTrue)
					So(sec.Key("FLOAT64_404").MustFloat64(2.5), ShouldEqual, 2.5)
					So(sec.Key("INT_404").MustInt(15), ShouldEqual, 15)
					So(sec.Key("INT_404").MustInt64(15), ShouldEqual, 15)
				})
			})
		})

		Convey("Get value with candidates", func() {
			sec := cfg.Section("types")
			So(sec.Key("STRING").In("", []string{"str", "arr", "types"}), ShouldEqual, "str")
			So(sec.Key("FLOAT64").InFloat64(0, []float64{1.25, 2.5, 3.75}), ShouldEqual, 1.25)
			So(sec.Key("INT").InInt(0, []int{10, 20, 30}), ShouldEqual, 10)
			So(sec.Key("INT").InInt64(0, []int64{10, 20, 30}), ShouldEqual, 10)

			Convey("Get value with candidates and default value", func() {
				So(sec.Key("STRING_404").In("str", []string{"str", "arr", "types"}), ShouldEqual, "str")
				So(sec.Key("FLOAT64_404").InFloat64(1.25, []float64{1.25, 2.5, 3.75}), ShouldEqual, 1.25)
				So(sec.Key("INT_404").InInt(10, []int{10, 20, 30}), ShouldEqual, 10)
				So(sec.Key("INT64_404").InInt64(10, []int64{10, 20, 30}), ShouldEqual, 10)
			})
		})

		Convey("Get values into slice", func() {
			sec := cfg.Section("array")
			So(strings.Join(sec.Key("STRINGS").Strings(","), ","), ShouldEqual, "en,zh,de")
			So(len(sec.Key("STRINGS_404").Strings(",")), ShouldEqual, 0)

			vals1 := sec.Key("FLOAT64S").Float64s(",")
			for i, v := range []float64{1.1, 2.2, 3.3} {
				So(vals1[i], ShouldEqual, v)
			}

			vals2 := sec.Key("INTS").Ints(",")
			for i, v := range []int{1, 2, 3} {
				So(vals2[i], ShouldEqual, v)
			}

			vals3 := sec.Key("INTS").Int64s(",")
			for i, v := range []int64{1, 2, 3} {
				So(vals3[i], ShouldEqual, v)
			}
		})

		Convey("Get key hash", func() {
			cfg.Section("").KeysHash()
		})

		Convey("Set key value", func() {
			k := cfg.Section("author").Key("NAME")
			k.SetValue("无闻")
			So(k.String(), ShouldEqual, "无闻")
		})

		Convey("Get key strings", func() {
			So(strings.Join(cfg.Section("types").KeyStrings(), ","), ShouldEqual, "STRING,BOOL,FLOAT64,INT")
		})

		Convey("Delete a key", func() {
			cfg.Section("package.sub").DeleteKey("UNUSED_KEY")
			_, err := cfg.Section("package.sub").GetKey("UNUSED_KEY")
			So(err, ShouldNotBeNil)
		})

		Convey("Get section strings", func() {
			So(strings.Join(cfg.SectionStrings(), ","), ShouldEqual, "DEFAULT,author,package,package.sub,features,types,array,note,advance")
		})

		Convey("Delete a section", func() {
			cfg.DeleteSection("")
			So(cfg.SectionStrings()[0], ShouldNotEqual, DEFAULT_SECTION)
		})
	})

	Convey("Test getting and setting bad values", t, func() {
		cfg, err := Load([]byte(_CONF_DATA), "testdata/conf.ini")
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		Convey("Create new key with empty name", func() {
			k, err := cfg.Section("").NewKey("", "")
			So(err, ShouldNotBeNil)
			So(k, ShouldBeNil)
		})

		Convey("Create new section with empty name", func() {
			s, err := cfg.NewSection("")
			So(err, ShouldNotBeNil)
			So(s, ShouldBeNil)
		})

		Convey("Get section that not exists", func() {
			s, err := cfg.GetSection("404")
			So(err, ShouldNotBeNil)
			So(s, ShouldBeNil)

			s = cfg.Section("404")
			So(s, ShouldNotBeNil)
		})
	})
}

func Test_File_Append(t *testing.T) {
	Convey("Append data sources", t, func() {
		cfg, err := Load([]byte(""))
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		So(cfg.Append([]byte(""), []byte("")), ShouldBeNil)

		Convey("Append bad data sources", func() {
			So(cfg.Append(1), ShouldNotBeNil)
			So(cfg.Append([]byte(""), 1), ShouldNotBeNil)
		})
	})
}

func Test_File_SaveTo(t *testing.T) {
	Convey("Save file", t, func() {
		cfg, err := Load([]byte(_CONF_DATA), "testdata/conf.ini")
		So(err, ShouldBeNil)
		So(cfg, ShouldNotBeNil)

		So(cfg.SaveTo("testdata/conf_out.ini"), ShouldBeNil)
	})
}

func Benchmark_Key_Value(b *testing.B) {
	c, _ := Load([]byte(_CONF_DATA))
	for i := 0; i < b.N; i++ {
		c.Section("").Key("NAME").Value()
	}
}

func Benchmark_Key_String(b *testing.B) {
	c, _ := Load([]byte(_CONF_DATA))
	for i := 0; i < b.N; i++ {
		c.Section("").Key("NAME").String()
	}
}

func Benchmark_Key_Value_NonBlock(b *testing.B) {
	c, _ := Load([]byte(_CONF_DATA))
	c.BlockMode = false
	for i := 0; i < b.N; i++ {
		c.Section("").Key("NAME").Value()
	}
}

func Benchmark_Key_String_NonBlock(b *testing.B) {
	c, _ := Load([]byte(_CONF_DATA))
	c.BlockMode = false
	for i := 0; i < b.N; i++ {
		c.Section("").Key("NAME").String()
	}
}

func Benchmark_Key_SetValue(b *testing.B) {
	c, _ := Load([]byte(_CONF_DATA))
	for i := 0; i < b.N; i++ {
		c.Section("").Key("NAME").SetValue("10")
	}
}
