package msgp

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"
)

func TestUnmarshalJSON(t *testing.T) {
	var buf bytes.Buffer
	enc := NewWriter(&buf)
	enc.WriteMapHeader(5)

	enc.WriteString("thing_1")
	enc.WriteString("a string object")

	enc.WriteString("a_map")
	enc.WriteMapHeader(2)

	// INNER
	enc.WriteString("cmplx")
	enc.WriteComplex64(complex(1.0, 1.0))
	enc.WriteString("int_b")
	enc.WriteInt64(-100)

	enc.WriteString("an extension")
	enc.WriteExtension(&RawExtension{Type: 1, Data: []byte("blaaahhh")})

	enc.WriteString("some bytes")
	enc.WriteBytes([]byte("here are some bytes"))

	enc.WriteString("now")
	enc.WriteTime(time.Now())

	enc.Flush()

	var js bytes.Buffer
	_, err := UnmarshalAsJSON(&js, buf.Bytes())
	if err != nil {
		t.Logf("%s", js.Bytes())
		t.Fatal(err)
	}
	mp := make(map[string]interface{})
	err = json.Unmarshal(js.Bytes(), &mp)
	if err != nil {
		t.Log(js.String())
		t.Fatalf("Error unmarshaling: %s", err)
	}

	if len(mp) != 5 {
		t.Errorf("map length should be %d, not %d", 5, len(mp))
	}

	so, ok := mp["thing_1"]
	if !ok || so != "a string object" {
		t.Errorf("expected %q; got %q", "a string object", so)
	}

	if _, ok := mp["now"]; !ok {
		t.Error(`"now" field doesn't exist`)
	}

	c, ok := mp["a_map"]
	if !ok {
		t.Error(`"a_map" field doesn't exist`)
	} else {
		if m, ok := c.(map[string]interface{}); ok {
			if _, ok := m["cmplx"]; !ok {
				t.Error(`"a_map.cmplx" doesn't exist`)
			}
		} else {
			t.Error(`can't type-assert "c" to map[string]interface{}`)
		}

	}

	t.Logf("JSON: %s", js.Bytes())
}

func BenchmarkUnmarshalAsJSON(b *testing.B) {
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
	_, err := UnmarshalAsJSON(&js, bts)
	if err != nil {
		b.Fatal(err)
	}
	b.SetBytes(int64(len(js.Bytes())))
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		js.Reset()
		UnmarshalAsJSON(&js, bts)
	}
}
