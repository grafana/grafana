package msgp

import (
	"bytes"
	"math/rand"
	"testing"
	"time"
)

var extSizes = [...]int{0, 1, 2, 4, 8, 16, int(tint8), int(tuint16), int(tuint32)}

func randomExt() RawExtension {
	e := RawExtension{}
	e.Type = int8(rand.Int())
	e.Data = RandBytes(extSizes[rand.Intn(len(extSizes))])
	return e
}

func TestReadWriteExtension(t *testing.T) {
	rand.Seed(time.Now().Unix())
	var buf bytes.Buffer
	en := NewWriter(&buf)
	dc := NewReader(&buf)

	for i := 0; i < 25; i++ {
		buf.Reset()
		e := randomExt()
		en.WriteExtension(&e)
		en.Flush()
		err := dc.ReadExtension(&e)
		if err != nil {
			t.Errorf("error with extension (length %d): %s", len(buf.Bytes()), err)
		}
	}
}

func TestReadWriteExtensionBytes(t *testing.T) {
	var bts []byte
	rand.Seed(time.Now().Unix())

	for i := 0; i < 24; i++ {
		e := randomExt()
		bts, _ = AppendExtension(bts[0:0], &e)
		_, err := ReadExtensionBytes(bts, &e)
		if err != nil {
			t.Errorf("error with extension (length %d): %s", len(bts), err)
		}
	}
}
