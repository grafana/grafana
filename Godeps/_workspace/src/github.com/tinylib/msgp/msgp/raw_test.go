package msgp

import (
	"bytes"
	"testing"
	"time"
)

// all standard interfaces
type allifaces interface {
	Encodable
	Decodable
	Marshaler
	Unmarshaler
	Sizer
}

func TestRaw(t *testing.T) {
	bts := make([]byte, 0, 512)
	bts = AppendMapHeader(bts, 3)
	bts = AppendString(bts, "key_one")
	bts = AppendFloat64(bts, -1.0)
	bts = AppendString(bts, "key_two")
	bts = AppendString(bts, "value_two")
	bts = AppendString(bts, "key_three")
	bts = AppendTime(bts, time.Now())

	var r Raw

	// verify that Raw satisfies
	// the interfaces we want it to
	var _ allifaces = &r

	// READ TESTS

	extra, err := r.UnmarshalMsg(bts)
	if err != nil {
		t.Fatal("error from UnmarshalMsg:", err)
	}
	if len(extra) != 0 {
		t.Errorf("expected 0 bytes left; found %d", len(extra))
	}
	if !bytes.Equal([]byte(r), bts) {
		t.Fatal("value of raw and input slice are not equal after UnmarshalMsg")
	}

	r = r[:0]

	var buf bytes.Buffer
	buf.Write(bts)

	rd := NewReader(&buf)

	err = r.DecodeMsg(rd)
	if err != nil {
		t.Fatal("error from DecodeMsg:", err)
	}

	if !bytes.Equal([]byte(r), bts) {
		t.Fatal("value of raw and input slice are not equal after DecodeMsg")
	}

	// WRITE TESTS

	buf.Reset()
	wr := NewWriter(&buf)
	err = r.EncodeMsg(wr)
	if err != nil {
		t.Fatal("error from EncodeMsg:", err)
	}

	wr.Flush()
	if !bytes.Equal(buf.Bytes(), bts) {
		t.Fatal("value of buf.Bytes() and input slice are not equal after EncodeMsg")
	}

	var outsl []byte
	outsl, err = r.MarshalMsg(outsl)
	if err != nil {
		t.Fatal("error from MarshalMsg:", err)
	}
	if !bytes.Equal(outsl, bts) {
		t.Fatal("value of output and input of MarshalMsg are not equal.")
	}
}
