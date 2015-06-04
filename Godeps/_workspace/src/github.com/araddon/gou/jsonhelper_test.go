package gou

import (
	"bytes"
	"encoding/json"
	. "github.com/araddon/gou/goutest"
	"github.com/bmizerany/assert"
	"log"
	"os"
	"strings"
	"testing"
)

//  go test -bench=".*"
//  go test -run="(Util)"

var (
	jh JsonHelper
)

func init() {
	SetLogger(log.New(os.Stderr, "", log.Ltime|log.Lshortfile), "debug")
	// create test data
	json.Unmarshal([]byte(`{
		"name":"aaron",
		"nullstring":null,
		"ints":[1,2,3,4],
		"int":1,
		"intstr":"1",
		"int64":1234567890,
		"float64":123.456,
		"float64str":"123.456",
		"MaxSize" : 1048576,
		"strings":["string1"],
		"stringscsv":"string1,string2",
		"nested":{
			"nest":"string2",
			"strings":["string1"],
			"int":2,
			"list":["value"],
			"nest2":{
				"test":"good"
			}
		},
		"nested2":[
			{"sub":2}
		],
		"period.name":"value"
	}`), &jh)
}

func TestJsonRawWriter(t *testing.T) {
	var buf bytes.Buffer
	buf.WriteString(`"hello"`)
	raw := json.RawMessage(buf.Bytes())
	bya, _ := json.Marshal(&buf)
	Debug(string(bya))
	bya, _ = json.Marshal(&raw)
	Debug(string(bya))

	/*
		bya, err := json.Marshal(buf)
		Assert(string(bya) == `"hello"`, t, "Should be hello but was %s", string(bya))
		Debug(string(buf.Bytes()), err)
		var jrw JsonRawWriter
		jrw.WriteString(`"hello"`)
		Debug(jrw.Raw())
		bya, err = json.Marshal(jrw.Raw())
		Assert(string(bya) == `"hello"`, t, "Should be hello but was %s", string(bya))
		Debug(string(jrw.Bytes()), err)
	*/
}

func TestJsonHelper(t *testing.T) {

	Assert(jh.String("name") == "aaron", t, "should get 'aaron' %s", jh.String("name"))
	Assert(jh.String("nullstring") == "", t, "should get '' %s", jh.String("nullstring"))

	Assert(jh.Int("int") == 1, t, "get int ")
	Assert(jh.Int("ints[0]") == 1, t, "get int from array %d", jh.Int("ints[0]"))
	Assert(jh.Int("ints[2]") == 3, t, "get int from array %d", jh.Int("ints[0]"))
	Assert(len(jh.Ints("ints")) == 4, t, "get int array %v", jh.Ints("ints"))
	Assert(jh.Int64("int64") == 1234567890, t, "get int")
	Assert(jh.Int("nested.int") == 2, t, "get int")
	Assert(jh.String("nested.nest") == "string2", t, "should get string %s", jh.String("nested.nest"))
	Assert(jh.String("nested.nest2.test") == "good", t, "should get string %s", jh.String("nested.nest2.test"))
	Assert(jh.String("nested.list[0]") == "value", t, "get string from array")
	Assert(jh.Int("nested2[0].sub") == 2, t, "get int from obj in array %d", jh.Int("nested2[0].sub"))

	Assert(jh.Int("MaxSize") == 1048576, t, "get int, test capitalization? ")
	sl := jh.Strings("strings")
	Assert(len(sl) == 1 && sl[0] == "string1", t, "get strings ")
	sl = jh.Strings("stringscsv")
	Assert(len(sl) == 2 && sl[0] == "string1", t, "get strings ")

	i64, ok := jh.Int64Safe("int64")
	Assert(ok, t, "int64safe ok")
	Assert(i64 == 1234567890, t, "int64safe value")

	u64, ok := jh.Uint64Safe("int64")
	Assert(ok, t, "uint64safe ok")
	Assert(u64 == 1234567890, t, "int64safe value")
	_, ok = jh.Uint64Safe("notexistent")
	assert.Tf(t, !ok, "should not be ok")
	_, ok = jh.Uint64Safe("name")
	assert.Tf(t, !ok, "should not be ok")

	i, ok := jh.IntSafe("int")
	Assert(ok, t, "intsafe ok")
	Assert(i == 1, t, "intsafe value")

	l := jh.List("nested2")
	Assert(len(l) == 1, t, "get list")

	fv, ok := jh.Float64Safe("name")
	assert.Tf(t, !ok, "floatsafe not ok")
	fv, ok = jh.Float64Safe("float64")
	assert.Tf(t, ok, "floatsafe ok")
	assert.Tf(t, CloseEnuf(fv, 123.456), "floatsafe value %v", fv)
	fv, ok = jh.Float64Safe("float64str")
	assert.Tf(t, ok, "floatsafe ok")
	assert.Tf(t, CloseEnuf(fv, 123.456), "floatsafe value %v", fv)

	jhm := jh.Helpers("nested2")
	Assert(len(jhm) == 1, t, "get list of helpers")
	Assert(jhm[0].Int("sub") == 2, t, "Should get list of helpers")

}

func TestJsonInterface(t *testing.T) {

	var jim map[string]JsonInterface
	err := json.Unmarshal([]byte(`{
		"nullstring":null,
		"string":"string",
		"int":22,
		"float":22.2,
		"floatstr":"22.2",
		"intstr":"22"
	}`), &jim)
	Assert(err == nil, t, "no error:%v ", err)
	Assert(jim["nullstring"].StringSh() == "", t, "nullstring: %v", jim["nullstring"])
	Assert(jim["string"].StringSh() == "string", t, "nullstring: %v", jim["string"])
	Assert(jim["int"].IntSh() == 22, t, "int: %v", jim["int"])
	Assert(jim["int"].StringSh() == "22", t, "int->string: %v", jim["int"])
	Assert(jim["int"].FloatSh() == float32(22), t, "int->float: %v", jim["int"])
	Assert(jim["float"].FloatSh() == 22.2, t, "float: %v", jim["float"])
	Assert(jim["float"].StringSh() == "22.2", t, "float->string: %v", jim["float"])
	Assert(jim["float"].IntSh() == 22, t, "float->int: %v", jim["float"])
	Assert(jim["intstr"].IntSh() == 22, t, "intstr: %v", jim["intstr"])
	Assert(jim["intstr"].FloatSh() == float32(22), t, "intstr->float: %v", jim["intstr"])
}

func TestJsonCoercion(t *testing.T) {

	Assert(jh.Int("intstr") == 1, t, "get string as int %s", jh.String("intstr"))
	Assert(jh.String("int") == "1", t, "get int as string %s", jh.String("int"))
	Assert(jh.Int("notint") == -1, t, "get non existent int = 0??? ")

}

func TestJsonPathNotation(t *testing.T) {

	// Now lets test xpath type syntax
	Assert(jh.Int("/MaxSize") == 1048576, t, "get int, test capitalization? ")
	Assert(jh.String("/nested/nest") == "string2", t, "should get string %s", jh.String("/nested/nest"))
	Assert(jh.String("/nested/list[0]") == "value", t, "get string from array")
	// note this one has period in name
	Assert(jh.String("/period.name") == "value", t, "test period in name ")

}

func TestFromReader(t *testing.T) {
	raw := `{"testing": 123}`
	reader := strings.NewReader(raw)
	jh, err := NewJsonHelperReader(reader)
	Assert(err == nil, t, "Unexpected error decoding json: %s", err)
	Assert(jh.Int("testing") == 123, t, "Unexpected value in json: %d", jh.Int("testing"))
}
