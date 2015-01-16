// Copyright 2013 Unknwon
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

package goconfig

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestLoadConfigFile(t *testing.T) {
	Convey("Load a single configuration file that does exist", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		Convey("Test GetSectionList", func() {
			So(c.GetSectionList(), ShouldResemble,
				[]string{"DEFAULT", "Demo", "What's this?", "url", "parent",
					"parent.child", "parent.child.child", "auto increment"})
		})

		Convey("Get value that does exist", func() {
			v, err := c.GetValue("Demo", "key2")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "test data")
		})

		Convey("Get value that does not exist", func() {
			_, err := c.GetValue("Demo", "key4")
			So(err, ShouldNotBeNil)
		})

		Convey("Get value that has empty value", func() {
			_, err := c.GetValue("What's this?", "empty_value")
			So(err, ShouldBeNil)
		})

		Convey("Get value that section does not exist", func() {
			_, err := c.GetValue("Demo404", "key4")
			So(err, ShouldNotBeNil)
		})

		Convey("Get value use parent-child feature", func() {
			v, err := c.GetValue("parent.child", "sex")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "male")
		})

		Convey("Get value use recursive feature", func() {
			v, err := c.GetValue("", "search")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "http://www.google.com")

			v, err = c.GetValue("url", "google_url")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "http://www.google.fake")
		})

		Convey("Set value that does exist", func() {
			So(c.SetValue("Demo", "key2", "hello man!"), ShouldBeFalse)
			v, err := c.GetValue("Demo", "key2")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "hello man!")
		})

		Convey("Set value that does not exist", func() {
			So(c.SetValue("Demo", "key4", "hello girl!"), ShouldBeTrue)
			v, err := c.GetValue("Demo", "key4")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "hello girl!")
			So(c.SetValue("", "gowalker", "https://gowalker.org"), ShouldBeTrue)
		})

		Convey("Test GetKeyList", func() {
			So(c.GetKeyList("Demo"), ShouldResemble,
				[]string{"key1", "key2", "key3", "quote", "key:1",
					"key:2=key:1", "中国", "chinese-var", "array_key"})
		})

		Convey("Delete a key", func() {
			So(c.DeleteKey("", "key404"), ShouldBeFalse)
			So(c.DeleteKey("Demo", "key404"), ShouldBeFalse)
			So(c.DeleteKey("Demo", "中国"), ShouldBeTrue)
			_, err := c.GetValue("Demo", "中国")
			So(err, ShouldNotBeNil)
			So(c.DeleteKey("404", "key"), ShouldBeFalse)
		})

		Convey("Delete all the keys", func() {
			for _, key := range c.GetKeyList("Demo") {
				So(c.DeleteKey("Demo", key), ShouldBeTrue)
			}
			So(c.GetKeyList("Demo"), ShouldResemble, []string{})
			So(len(c.GetKeyList("Demo")), ShouldEqual, 0)
		})

		Convey("Delete section that does not exist", func() {
			So(c.DeleteSection(""), ShouldBeTrue)
			So(c.DeleteSection("404"), ShouldBeFalse)
		})

		Convey("Get section that exists", func() {
			_, err = c.GetSection("")
			So(err, ShouldBeNil)
		})

		Convey("Get section that does not exist", func() {
			_, err = c.GetSection("404")
			So(err, ShouldNotBeNil)
		})

		Convey("Set section comments", func() {
			So(c.SetSectionComments("", "default section comments"), ShouldBeTrue)
		})

		Convey("Get section comments", func() {
			So(c.GetSectionComments(""), ShouldEqual, "")
		})

		Convey("Set key comments", func() {
			So(c.SetKeyComments("", "search", "search comments"), ShouldBeTrue)
			So(c.SetKeyComments("404", "search", ""), ShouldBeTrue)
		})

		Convey("Get key comments", func() {
			So(c.GetKeyComments("", "google"), ShouldEqual, "; Google")
		})

		Convey("Delete all the sections", func() {
			for _, sec := range c.GetSectionList() {
				So(c.DeleteSection(sec), ShouldBeTrue)
			}
			So(c.GetSectionList(), ShouldResemble, []string{})
			So(len(c.GetSectionList()), ShouldEqual, 0)
		})
	})

	Convey("Load a single configuration file that does not exist", t, func() {
		_, err := LoadConfigFile("testdata/conf404.ini")
		So(err, ShouldNotBeNil)
	})

	Convey("Load multiple configuration files", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini", "testdata/conf2.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		Convey("Get value that does not exist in 1st file", func() {
			v, err := c.GetValue("new section", "key1")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "conf.ini does not have this key")
		})

		Convey("Get value that overwrited in 2nd file", func() {
			v, err := c.GetValue("Demo", "key2")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, "rewrite this key of conf.ini")
		})
	})
}

func TestGetKeyList(t *testing.T) {
	Convey("Get key list", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		Convey("Get ket list that does exist", func() {
			So(c.GetKeyList("Demo"), ShouldResemble,
				[]string{"key1", "key2", "key3", "quote", "key:1",
					"key:2=key:1", "中国", "chinese-var", "array_key"})
			So(c.GetKeyList(""), ShouldResemble, []string{"google", "search"})
		})

		Convey("Get key list that not exist", func() {
			So(c.GetKeyList("404"), ShouldBeNil)
		})
	})
}

func TestSaveConfigFile(t *testing.T) {
	Convey("Save a ConfigFile to file system", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini", "testdata/conf2.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		c.SetValue("", "", "empty")

		So(SaveConfigFile(c, "testdata/conf_test.ini"), ShouldBeNil)
	})
}

func TestReload(t *testing.T) {
	Convey("Reload a configuration file", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini", "testdata/conf2.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		So(c.Reload(), ShouldBeNil)
	})
}

func TestAppendFiles(t *testing.T) {
	Convey("Reload a configuration file", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		So(c.AppendFiles("testdata/conf2.ini"), ShouldBeNil)
	})
}

func TestTypes(t *testing.T) {
	Convey("Return with types", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		Convey("Return bool", func() {
			v, err := c.Bool("parent.child", "married")
			So(err, ShouldBeNil)
			So(v, ShouldBeTrue)

			_, err = c.Bool("parent.child", "died")
			So(err, ShouldNotBeNil)
		})

		Convey("Return float64", func() {
			v, err := c.Float64("parent", "money")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, 1.25)

			_, err = c.Float64("parent", "balance")
			So(err, ShouldNotBeNil)
		})

		Convey("Return int", func() {
			v, err := c.Int("parent", "age")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, 32)

			_, err = c.Int("parent", "children")
			So(err, ShouldNotBeNil)
		})

		Convey("Return int64", func() {
			v, err := c.Int64("parent", "age")
			So(err, ShouldBeNil)
			So(v, ShouldEqual, 32)

			_, err = c.Int64("parent", "children")
			So(err, ShouldNotBeNil)
		})
	})
}

func TestMust(t *testing.T) {
	Convey("Must return with type", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		Convey("Return string", func() {
			So(c.MustValue("parent.child", "name"), ShouldEqual, "john")
			So(c.MustValue("parent.child", "died"), ShouldEqual, "")
			So(c.MustValue("parent.child", "died", "no"), ShouldEqual, "no")
		})

		Convey("Return string and bool", func() {
			val, ok := c.MustValueSet("parent.child", "died")
			So(val, ShouldEqual, "")
			So(ok, ShouldBeFalse)
			val, ok = c.MustValueSet("parent.child", "died", "no")
			So(val, ShouldEqual, "no")
			So(ok, ShouldBeTrue)
		})

		Convey("Return bool", func() {
			So(c.MustBool("parent.child", "married"), ShouldBeTrue)
			So(c.MustBool("parent.child", "died"), ShouldBeFalse)
			So(c.MustBool("parent.child", "died", true), ShouldBeTrue)
		})

		Convey("Return float64", func() {
			So(c.MustFloat64("parent", "money"), ShouldEqual, 1.25)
			So(c.MustFloat64("parent", "balance"), ShouldEqual, 0.0)
			So(c.MustFloat64("parent", "balance", 1.25), ShouldEqual, 1.25)
		})

		Convey("Return int", func() {
			So(c.MustInt("parent", "age"), ShouldEqual, 32)
			So(c.MustInt("parent", "children"), ShouldEqual, 0)
			So(c.MustInt("parent", "children", 3), ShouldEqual, 3)
		})

		Convey("Return int64", func() {
			So(c.MustInt64("parent", "age"), ShouldEqual, 32)
			So(c.MustInt64("parent", "children"), ShouldEqual, 0)
			So(c.MustInt64("parent", "children", 3), ShouldEqual, 3)
		})
	})
}

func TestRange(t *testing.T) {
	Convey("Must return with range", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		So(c.MustValueRange("What's this?", "name", "joe", []string{"hello"}), ShouldEqual, "joe")
		So(c.MustValueRange("What's this?", "name404", "joe", []string{"hello"}), ShouldEqual, "joe")
		So(c.MustValueRange("What's this?", "name", "joe", []string{"hello", "try one more value ^-^"}),
			ShouldEqual, "try one more value ^-^")
	})
}

func TestArray(t *testing.T) {
	Convey("Must return with string array", t, func() {
		c, err := LoadConfigFile("testdata/conf.ini")
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)

		So(fmt.Sprintf("%s", c.MustValueArray("Demo", "array_key", ",")), ShouldEqual, "[1 2 3 4 5]")
		So(fmt.Sprintf("%s", c.MustValueArray("Demo", "array_key404", ",")), ShouldEqual, "[]")
	})
}

func TestLoadFromData(t *testing.T) {
	Convey("Load config file from data", t, func() {
		c, err := LoadFromData([]byte(""))
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)
	})
}
