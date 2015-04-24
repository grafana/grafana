gou - Go Utilities
===========================

Go Utilities (logging, json)

JsonHelper
===============

A Go Json Helper, focused on Type coercion, and json path query.

```go
	package main
	import . "github.com/araddon/gou"
	import . "github.com/araddon/gou/goutest"
	import "testing"


	func TestJsonHelper() {

		var jsonData := []byte(`{
			"name":"aaron",
			"nullstring":null,
			"ints":[1,2,3,4],
			"int":1,
			"intstr":"1",
			"int64":1234567890,
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
		}`

		jh := NewJsonHelper(jsonData)

		// String method
		Assert(jh.String("name") == "aaron", t, "should get 'aaron' %s", jh.String("name"))
		// Int Method
		Assert(jh.Int("int") == 1, t, "get int ")
		// Selecting items from an array
		Assert(jh.Int("ints[0]") == 1, t, "get int from array %d", jh.Int("ints[0]"))
		Assert(jh.Int("ints[2]") == 3, t, "get int from array %d", jh.Int("ints[0]"))
		// Getting arrays
		Assert(len(jh.Ints("ints")) == 4, t, "get int array %v", jh.Ints("ints"))
		// Type coercion to Int64
		Assert(jh.Int64("int64") == 1234567890, t, "get int")
		Assert(jh.Int("nested.int") == 2, t, "get int")

		// Path based selection
		Assert(jh.String("nested.nest") == "string2", t, "should get string %s", jh.String("nested.nest"))
		Assert(jh.String("nested.nest2.test") == "good", t, "should get string %s", jh.String("nested.nest2.test"))
		Assert(jh.String("nested.list[0]") == "value", t, "get string from array")
		Assert(jh.Int("nested2[0].sub") == 2, t, "get int from obj in array %d", jh.Int("nested2[0].sub"))

		// casing?
		Assert(jh.Int("MaxSize") == 1048576, t, "get int, test capitalization? ")
		sl := jh.Strings("strings")
		Assert(len(sl) == 1 && sl[0] == "string1", t, "get strings ")
		sl = jh.Strings("stringscsv")
		Assert(len(sl) == 2 && sl[0] == "string1", t, "get strings ")

		// Safe gets
		i64, ok := jh.Int64Safe("int64")
		Assert(ok, t, "int64safe ok")
		Assert(i64 == 1234567890, t, "int64safe value")

		i, ok := jh.IntSafe("int")
		Assert(ok, t, "intsafe ok")
		Assert(i == 1, t, "intsafe value")

		l := jh.List("nested2")
		Assert(len(l) == 1, t, "get list")

		jhm := jh.Helpers("nested2")
		Assert(len(jhm) == 1, t, "get list of helpers")
		Assert(jhm[0].Int("sub") == 2, t, "Should get list of helpers")

		// Now lets test xpath type syntax
		Assert(jh.Int("/MaxSize") == 1048576, t, "get int, test capitalization? ")
		Assert(jh.String("/nested/nest") == "string2", t, "should get string %s", jh.String("/nested/nest"))
		Assert(jh.String("/nested/list[0]") == "value", t, "get string from array")
		// note this one has period in name
		Assert(jh.String("/period.name") == "value", t, "test period in name ")
	}

```

	
Logging
===============

Yet Another Go Logger, configureable logging.

```go
	package main
	import "github.com/araddon/gou"
	import "flag"

	var logLevel *string = flag.String("logging", "debug", "Which log level: [debug,info,warn,error,fatal]")

	func main() {

		flag.Parse()
		gou.SetupLogging(*logLevel)

		// logging methods
		gou.Debug("hello", thing, " more ", stuff)

		gou.Error("hello")

		gou.Errorf("hello %v", thing)
	}

```

License
===============
MIT License
