package gou

import (
	. "github.com/araddon/gou/goutest"
	"testing"
)

func TestCoerce(t *testing.T) {

	data := map[string]interface{}{
		"int":     4,
		"float":   45.3,
		"string":  "22",
		"stringf": "22.2",
	}
	Assert(CoerceStringShort(data["int"]) == "4", t, "get int as string")
	Assert(CoerceStringShort(data["float"]) == "45.3", t, "get float as string: %v", data["float"])
	Assert(CoerceStringShort(data["string"]) == "22", t, "get string as string: %v", data["string"])
	Assert(CoerceStringShort(data["stringf"]) == "22.2", t, "get stringf as string: %v", data["stringf"])

	Assert(CoerceIntShort(data["int"]) == 4, t, "get int as int: %v", data["int"])
	Assert(CoerceIntShort(data["float"]) == 45, t, "get float as int: %v", data["float"])
	Assert(CoerceIntShort(data["string"]) == 22, t, "get string as int: %v", data["string"])
	Assert(CoerceIntShort(data["stringf"]) == 22, t, "get stringf as int: %v", data["stringf"])
}
