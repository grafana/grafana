package msgp

import (
	"bytes"
	"encoding/json"
	"reflect"
	"testing"
)

func TestCopyJSON(t *testing.T) {
	var buf bytes.Buffer
	enc := NewWriter(&buf)
	enc.WriteMapHeader(5)

	enc.WriteString("thing_1")
	enc.WriteString("a string object")

	enc.WriteString("a_map")
	enc.WriteMapHeader(2)
	enc.WriteString("float_a")
	enc.WriteFloat32(1.0)
	enc.WriteString("int_b")
	enc.WriteInt64(-100)

	enc.WriteString("some bytes")
	enc.WriteBytes([]byte("here are some bytes"))
	enc.WriteString("a bool")
	enc.WriteBool(true)

	enc.WriteString("a map")
	enc.WriteMapStrStr(map[string]string{
		"internal_one": "blah",
		"internal_two": "blahhh...",
	})
	enc.Flush()

	var js bytes.Buffer
	_, err := CopyToJSON(&js, &buf)
	if err != nil {
		t.Fatal(err)
	}
	mp := make(map[string]interface{})
	err = json.Unmarshal(js.Bytes(), &mp)
	if err != nil {
		t.Log(js.String())
		t.Fatalf("Error unmarshaling: %s", err)
	}

	if len(mp) != 5 {
		t.Errorf("map length should be %d, not %d", 4, len(mp))
	}

	so, ok := mp["thing_1"]
	if !ok || so != "a string object" {
		t.Errorf("expected %q; got %q", "a string object", so)
	}

	in, ok := mp["a map"]
	if !ok {
		t.Error("no key 'a map'")
	}
	if inm, ok := in.(map[string]interface{}); !ok {
		t.Error("inner map not type-assertable to map[string]interface{}")
	} else {
		inm1, ok := inm["internal_one"]
		if !ok || !reflect.DeepEqual(inm1, "blah") {
			t.Errorf("inner map field %q should be %q, not %q", "internal_one", "blah", inm1)
		}
	}
}

func BenchmarkCopyToJSON(b *testing.B) {
	var buf bytes.Buffer
	enc := NewWriter(&buf)
	enc.WriteMapHeader(4)

	enc.WriteString("thing_1")
	enc.WriteString("a string object")

	enc.WriteString("a_first_map")
	enc.WriteMapHeader(2)
	enc.WriteString("float_a")
	enc.WriteFloat32(1.0)
	enc.WriteString("int_b")
	enc.WriteInt64(-100)

	enc.WriteString("an array")
	enc.WriteArrayHeader(2)
	enc.WriteBool(true)
	enc.WriteUint(2089)

	enc.WriteString("a_second_map")
	enc.WriteMapStrStr(map[string]string{
		"internal_one": "blah",
		"internal_two": "blahhh...",
	})
	enc.Flush()

	var js bytes.Buffer
	bts := buf.Bytes()
	_, err := CopyToJSON(&js, &buf)
	if err != nil {
		b.Fatal(err)
	}
	b.SetBytes(int64(len(js.Bytes())))
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		js.Reset()
		CopyToJSON(&js, bytes.NewReader(bts))
	}
}

func BenchmarkStdlibJSON(b *testing.B) {
	obj := map[string]interface{}{
		"thing_1": "a string object",
		"a_first_map": map[string]interface{}{
			"float_a": float32(1.0),
			"float_b": -100,
		},
		"an array": []interface{}{
			"part_A",
			"part_B",
		},
		"a_second_map": map[string]interface{}{
			"internal_one": "blah",
			"internal_two": "blahhh...",
		},
	}
	var js bytes.Buffer
	err := json.NewEncoder(&js).Encode(&obj)
	if err != nil {
		b.Fatal(err)
	}
	b.SetBytes(int64(len(js.Bytes())))
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		js.Reset()
		json.NewEncoder(&js).Encode(&obj)
	}
}
