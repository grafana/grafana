package msgp

import (
	"bytes"
	"reflect"
	"testing"
)

func TestRemove(t *testing.T) {
	var buf bytes.Buffer
	w := NewWriter(&buf)
	w.WriteMapHeader(3)
	w.WriteString("first")
	w.WriteFloat64(-3.1)
	w.WriteString("second")
	w.WriteString("DELETE ME!!!")
	w.WriteString("third")
	w.WriteBytes([]byte("blah"))
	w.Flush()

	raw := Remove("second", buf.Bytes())

	m, _, err := ReadMapStrIntfBytes(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 2 {
		t.Errorf("expected %d fields; found %d", 2, len(m))
	}
	if _, ok := m["first"]; !ok {
		t.Errorf("field %q not found", "first")
	}
	if _, ok := m["third"]; !ok {
		t.Errorf("field %q not found", "third")
	}
	if _, ok := m["second"]; ok {
		t.Errorf("field %q (deleted field) still present", "second")
	}
}

func TestLocate(t *testing.T) {
	var buf bytes.Buffer
	en := NewWriter(&buf)
	en.WriteMapHeader(2)
	en.WriteString("thing_one")
	en.WriteString("value_one")
	en.WriteString("thing_two")
	en.WriteFloat64(2.0)
	en.Flush()

	field := Locate("thing_one", buf.Bytes())
	if len(field) == 0 {
		t.Fatal("field not found")
	}

	if !HasKey("thing_one", buf.Bytes()) {
		t.Fatal("field not found")
	}

	var zbuf bytes.Buffer
	w := NewWriter(&zbuf)
	w.WriteString("value_one")
	w.Flush()

	if !bytes.Equal(zbuf.Bytes(), field) {
		t.Errorf("got %q; wanted %q", field, zbuf.Bytes())
	}

	zbuf.Reset()
	w.WriteFloat64(2.0)
	w.Flush()
	field = Locate("thing_two", buf.Bytes())
	if len(field) == 0 {
		t.Fatal("field not found")
	}
	if !bytes.Equal(zbuf.Bytes(), field) {
		t.Errorf("got %q; wanted %q", field, zbuf.Bytes())
	}

	field = Locate("nope", buf.Bytes())
	if len(field) != 0 {
		t.Fatalf("wanted a zero-length returned slice")
	}

}

func TestReplace(t *testing.T) {
	// there are 4 cases that need coverage:
	//  - new value is smaller than old value
	//  - new value is the same size as the old value
	//  - new value is larger than old, but fits within cap(b)
	//  - new value is larger than old, and doesn't fit within cap(b)

	var buf bytes.Buffer
	en := NewWriter(&buf)
	en.WriteMapHeader(3)
	en.WriteString("thing_one")
	en.WriteString("value_one")
	en.WriteString("thing_two")
	en.WriteFloat64(2.0)
	en.WriteString("some_bytes")
	en.WriteBytes([]byte("here are some bytes"))
	en.Flush()

	// same-size replacement
	var fbuf bytes.Buffer
	w := NewWriter(&fbuf)
	w.WriteFloat64(4.0)
	w.Flush()

	// replace 2.0 with 4.0 in field two
	raw := Replace("thing_two", buf.Bytes(), fbuf.Bytes())
	if len(raw) == 0 {
		t.Fatal("field not found")
	}
	var err error
	m := make(map[string]interface{})
	m, _, err = ReadMapStrIntfBytes(raw, m)
	if err != nil {
		t.Logf("%q", raw)
		t.Fatal(err)
	}

	if !reflect.DeepEqual(m["thing_two"], 4.0) {
		t.Errorf("wanted %v; got %v", 4.0, m["thing_two"])
	}

	// smaller-size replacement
	// replace 2.0 with []byte("hi!")
	fbuf.Reset()
	w.WriteBytes([]byte("hi!"))
	w.Flush()
	raw = Replace("thing_two", raw, fbuf.Bytes())
	if len(raw) == 0 {
		t.Fatal("field not found")
	}

	m, _, err = ReadMapStrIntfBytes(raw, m)
	if err != nil {
		t.Logf("%q", raw)
		t.Fatal(err)
	}

	if !reflect.DeepEqual(m["thing_two"], []byte("hi!")) {
		t.Errorf("wanted %v; got %v", []byte("hi!"), m["thing_two"])
	}

	// larger-size replacement
	fbuf.Reset()
	w.WriteBytes([]byte("some even larger bytes than before"))
	w.Flush()
	raw = Replace("some_bytes", raw, fbuf.Bytes())
	if len(raw) == 0 {
		t.Logf("%q", raw)
		t.Fatal(err)
	}

	m, _, err = ReadMapStrIntfBytes(raw, m)
	if err != nil {
		t.Logf("%q", raw)
		t.Fatal(err)
	}

	if !reflect.DeepEqual(m["some_bytes"], []byte("some even larger bytes than before")) {
		t.Errorf("wanted %v; got %v", []byte("hello there!"), m["some_bytes"])
	}

	// identical in-place replacement
	field := Locate("some_bytes", raw)
	newraw := CopyReplace("some_bytes", raw, field)

	if !bytes.Equal(newraw, raw) {
		t.Logf("in: %q", raw)
		t.Logf("out: %q", newraw)
		t.Error("bytes not equal after copyreplace")
	}
}

func BenchmarkLocate(b *testing.B) {
	var buf bytes.Buffer
	en := NewWriter(&buf)
	en.WriteMapHeader(3)
	en.WriteString("thing_one")
	en.WriteString("value_one")
	en.WriteString("thing_two")
	en.WriteFloat64(2.0)
	en.WriteString("thing_three")
	en.WriteBytes([]byte("hello!"))
	en.Flush()

	raw := buf.Bytes()
	// bytes/s will be the number of bytes traversed per unit of time
	field := Locate("thing_three", raw)
	b.SetBytes(int64(len(raw) - len(field)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Locate("thing_three", raw)
	}
}
