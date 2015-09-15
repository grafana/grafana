package msgp

import (
	"bytes"
	"testing"
)

func TestNumber(t *testing.T) {

	n := Number{}

	if n.Type() != IntType {
		t.Errorf("expected zero-value type to be %s; got %s", IntType, n.Type())
	}

	if n.String() != "0" {
		t.Errorf("expected Number{}.String() to be \"0\" but got %q", n.String())
	}

	n.AsInt(248)
	i, ok := n.Int()
	if !ok || i != 248 || n.Type() != IntType || n.String() != "248" {
		t.Errorf("%d in; %d out!", 248, i)
	}

	n.AsFloat64(3.141)
	f, ok := n.Float()
	if !ok || f != 3.141 || n.Type() != Float64Type || n.String() != "3.141" {
		t.Errorf("%f in; %f out!", 3.141, f)
	}

	n.AsUint(40000)
	u, ok := n.Uint()
	if !ok || u != 40000 || n.Type() != UintType || n.String() != "40000" {
		t.Errorf("%d in; %d out!", 40000, u)
	}

	nums := []interface{}{
		float64(3.14159),
		int64(-29081),
		uint64(90821983),
		float32(3.141),
	}

	var dat []byte
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	for _, n := range nums {
		dat, _ = AppendIntf(dat, n)
		wr.WriteIntf(n)
	}
	wr.Flush()

	mout := make([]Number, len(nums))
	dout := make([]Number, len(nums))

	rd := NewReader(&buf)
	unm := dat
	for i := range nums {
		var err error
		unm, err = mout[i].UnmarshalMsg(unm)
		if err != nil {
			t.Fatal("unmarshal error:", err)
		}
		err = dout[i].DecodeMsg(rd)
		if err != nil {
			t.Fatal("decode error:", err)
		}
		if mout[i] != dout[i] {
			t.Errorf("for %#v, got %#v from unmarshal and %#v from decode", nums[i], mout[i], dout[i])
		}
	}

	buf.Reset()
	var odat []byte
	for i := range nums {
		var err error
		odat, err = mout[i].MarshalMsg(odat)
		if err != nil {
			t.Fatal("marshal error:", err)
		}
		err = dout[i].EncodeMsg(wr)
	}
	wr.Flush()

	if !bytes.Equal(dat, odat) {
		t.Errorf("marshal: expected output %#v; got %#v", dat, odat)
	}

	if !bytes.Equal(dat, buf.Bytes()) {
		t.Errorf("encode: expected output %#v; got %#v", dat, buf.Bytes())
	}

}
