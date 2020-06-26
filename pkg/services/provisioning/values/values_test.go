package values

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/yaml.v2"
)

func TestValues(t *testing.T) {
	Convey("Values", t, func() {
		os.Setenv("INT", "1")
		os.Setenv("STRING", "test")
		os.Setenv("EMPTYSTRING", "")
		os.Setenv("BOOL", "true")

		Convey("IntValue", func() {
			type Data struct {
				Val IntValue `yaml:"val"`
			}
			d := &Data{}

			Convey("Should unmarshal simple number", func() {
				unmarshalingTest(`val: 1`, d)
				So(d.Val.Value(), ShouldEqual, 1)
				So(d.Val.Raw, ShouldEqual, "1")
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $INT`, d)
				So(d.Val.Value(), ShouldEqual, 1)
				So(d.Val.Raw, ShouldEqual, "$INT")
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldEqual, 0)
				So(d.Val.Raw, ShouldEqual, "")
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
				So(d.Val.Raw, ShouldEqual, "test")
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $STRING`, d)
				So(d.Val.Value(), ShouldEqual, "test")
				So(d.Val.Raw, ShouldEqual, "$STRING")
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldEqual, "")
				So(d.Val.Raw, ShouldEqual, "")
			})

			Convey("empty var should have empty value", func() {
				unmarshalingTest(`val: $EMPTYSTRING`, d)
				So(d.Val.Value(), ShouldEqual, "")
				So(d.Val.Raw, ShouldEqual, "$EMPTYSTRING")
			})

			Convey("$$ should be a literal $", func() {
				unmarshalingTest(`val: $$`, d)
				So(d.Val.Value(), ShouldEqual, "$")
				So(d.Val.Raw, ShouldEqual, "$$")
			})

			Convey("$$ should be a literal $ and not expanded within a string", func() {
				unmarshalingTest(`val: mY,Passwo$$rd`, d)
				So(d.Val.Value(), ShouldEqual, "mY,Passwo$rd")
				So(d.Val.Raw, ShouldEqual, "mY,Passwo$$rd")
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
				So(d.Val.Raw, ShouldEqual, "true")
			})

			Convey("Should unmarshal explicit string", func() {
				unmarshalingTest(`val: "true"`, d)
				So(d.Val.Value(), ShouldBeTrue)
				So(d.Val.Raw, ShouldEqual, "true")
			})

			Convey("Should unmarshal env var", func() {
				unmarshalingTest(`val: $BOOL`, d)
				So(d.Val.Value(), ShouldBeTrue)
				So(d.Val.Raw, ShouldEqual, "$BOOL")
			})

			Convey("Should ignore empty value", func() {
				unmarshalingTest(`val: `, d)
				So(d.Val.Value(), ShouldBeFalse)
				So(d.Val.Raw, ShouldEqual, "")
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
                     - six:
                         empty:
                   four:
                     nested:
                       onemore: $INT
                   multiline: >
                     Some text with $STRING
                   anchor: &label $INT
                   anchored: *label
               `
				unmarshalingTest(doc, d)

				type stringMap = map[string]interface{}
				So(d.Val.Value(), ShouldResemble, stringMap{
					"one": 1,
					"two": "test",
					"three": []interface{}{
						1,
						"two",
						stringMap{
							"three": stringMap{
								"inside": "test",
							},
						},
						stringMap{
							"six": stringMap{
								"empty": interface{}(nil),
							},
						},
					},
					"four": stringMap{
						"nested": stringMap{
							"onemore": "1",
						},
					},
					"multiline": "Some text with test\n",
					"anchor":    "1",
					"anchored":  "1",
				})

				So(d.Val.Raw, ShouldResemble, stringMap{
					"one": 1,
					"two": "$STRING",
					"three": []interface{}{
						1,
						"two",
						stringMap{
							"three": stringMap{
								"inside": "$STRING",
							},
						},
						stringMap{
							"six": stringMap{
								"empty": interface{}(nil),
							},
						},
					},
					"four": stringMap{
						"nested": stringMap{
							"onemore": "$INT",
						},
					},
					"multiline": "Some text with $STRING\n",
					"anchor":    "$INT",
					"anchored":  "$INT",
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

				So(d.Val.Raw, ShouldResemble, map[string]string{
					"one":   "1",
					"two":   "test string",
					"three": "$STRING",
					"four":  "true",
				})

			})
		})

		Reset(func() {
			os.Unsetenv("INT")
			os.Unsetenv("STRING")
			os.Unsetenv("EMPTYSTRING")
			os.Unsetenv("BOOL")
		})
	})
}

func unmarshalingTest(document string, out interface{}) {
	err := yaml.Unmarshal([]byte(document), out)
	So(err, ShouldBeNil)
}

func TestValues_readFile(t *testing.T) {
	type Data struct {
		Val StringValue `yaml:"val"`
	}

	f, err := ioutil.TempFile(os.TempDir(), "file expansion *")
	require.NoError(t, err)
	file := f.Name()

	defer func() {
		require.NoError(t, os.Remove(file))
	}()

	const expected = "hello, world"
	_, err = f.WriteString(expected)
	require.NoError(t, err)
	require.NoError(t, f.Close())

	data := &Data{}
	err = yaml.Unmarshal([]byte(fmt.Sprintf("val: $__file{%s}", file)), data)
	require.NoError(t, err)
	assert.Equal(t, expected, data.Val.Value())
}

func TestValues_expanderError(t *testing.T) {
	type Data struct {
		Top JSONValue `yaml:"top"`
	}

	setting.AddExpander("fail", 0, failExpander{})

	data := &Data{}
	err := yaml.Unmarshal([]byte("top:\n  val: $__fail{val}"), data)
	require.Error(t, err)
	require.Truef(t, errors.Is(err, errExpand), "expected error to wrap: %v\ngot: %v", errExpand, err)
	assert.Empty(t, data)
}

var errExpand = errors.New("test error: bad expander")

type failExpander struct{}

func (f failExpander) SetupExpander(file *ini.File) error {
	return nil
}

func (f failExpander) Expand(s string) (string, error) {
	return "", errExpand
}
