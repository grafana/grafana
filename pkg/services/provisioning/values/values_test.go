package values

import (
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/yaml.v2"
	"testing"
)

func TestValues(t *testing.T) {
	Convey("Values", t, func() {
		oldGetEnv := getEnv
		getEnv = func(key string) string {
			return map[string]string{
				"INT":    "1",
				"STRING": "test",
				"BOOL":   "true",
			}[key]
		}

		Convey("IntValue", func() {
			type Data struct {
				Val IntValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal simple number", func() {
				unmarshalingTest(`val: 1`, d)
				So(d.Val.Value(), ShouldEqual, 1)
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $INT`, d)
				So(d.Val.Value(), ShouldEqual, 1)
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldEqual, 0)
			})
		})

		Convey("StringValue", func() {
			type Data struct {
				Val StringValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal simple string", func() {
				unmarshalingTest(`val: test`, d)
				So(d.Val.Value(), ShouldEqual, "test")
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $STRING`, d)
				So(d.Val.Value(), ShouldEqual, "test")
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldEqual, "")
			})
		})

		Convey("BoolValue", func() {
			type Data struct {
				Val BoolValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal bool value", func() {
				unmarshalingTest(`val: true`, d)
				So(d.Val.Value(), ShouldBeTrue)
			})

			Convey("Should unmarshal explicit string", func() {
				unmarshalingTest(`val: "true"`, d)
				So(d.Val.Value(), ShouldBeTrue)
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $BOOL`, d)
				So(d.Val.Value(), ShouldBeTrue)
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldBeFalse)
			})
		})

		Convey("JSONValue", func() {

			type Data struct {
				Val JSONValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal variable nesting", func() {
				doc := `
                 val:
                   one: 1
                   two: $STRING
                   three:
                     - 1
                     - two
                     - three:
                         inside: $STRING
                   four:
                     nested:
                       onemore: $INT
                   multiline: >
                     Some text with $STRING
                   anchor: &label $INT
                   anchored: *label
               `
				unmarshalingTest(doc, d)

				type anyMap = map[interface{}]interface{}
				So(d.Val.Value(), ShouldResemble, map[string]interface{}{
					"one": 1,
					"two": "test",
					"three": []interface{}{
						1, "two", anyMap{
							"three": anyMap{
								"inside": "test",
							},
						},
					},
					"four": anyMap{
						"nested": anyMap{
							"onemore": "1",
						},
					},
					"multiline": "Some text with test\n",
					"anchor":    "1",
					"anchored":  "1",
				})

			})
		})

		Convey("StringMapValue", func() {
			type Data struct {
				Val StringMapValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal mapping", func() {
				doc := `
                 val:
                   one: 1
                   two: "test string"
                   three: $STRING
                   four: true
               `
				unmarshalingTest(doc, d)
				So(d.Val.Value(), ShouldResemble, map[string]string{
					"one":   "1",
					"two":   "test string",
					"three": "test",
					"four":  "true",
				})

			})
		})

		Reset(func() {
			getEnv = oldGetEnv
		})
	})
}

func unmarshalingTest(document string, out interface{}) {
	err := yaml.Unmarshal([]byte(document), out)
	So(err, ShouldBeNil)
}
