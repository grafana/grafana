// +build linux darwin dragonfly freebsd netbsd openbsd

package msgp_test

import (
	"bytes"
	"crypto/rand"
	"github.com/tinylib/msgp/msgp"
	prand "math/rand"
	"os"
	"testing"
)

type rawBytes []byte

func (r rawBytes) MarshalMsg(b []byte) ([]byte, error) {
	return msgp.AppendBytes(b, []byte(r)), nil
}

func (r rawBytes) Msgsize() int {
	return msgp.BytesPrefixSize + len(r)
}

func (r *rawBytes) UnmarshalMsg(b []byte) ([]byte, error) {
	tmp, out, err := msgp.ReadBytesBytes(b, (*(*[]byte)(r))[:0])
	*r = rawBytes(tmp)
	return out, err
}

func TestReadWriteFile(t *testing.T) {
	t.Parallel()

	f, err := os.Create("tmpfile")
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		f.Close()
		os.Remove("tmpfile")
	}()

	data := make([]byte, 1024*1024)
	rand.Read(data)

	err = msgp.WriteFile(rawBytes(data), f)
	if err != nil {
		t.Fatal(err)
	}

	var out rawBytes
	f.Seek(0, os.SEEK_SET)
	err = msgp.ReadFile(&out, f)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal([]byte(out), []byte(data)) {
		t.Fatal("Input and output not equal.")
	}
}

var blobstrings = []string{"", "a string", "a longer string here!"}
var blobfloats = []float64{0.0, -1.0, 1.0, 3.1415926535}
var blobints = []int64{0, 1, -1, 80000, 1 << 30}
var blobbytes = [][]byte{[]byte{}, []byte("hello"), []byte("{\"is_json\":true,\"is_compact\":\"unable to determine\"}")}

func BenchmarkWriteReadFile(b *testing.B) {

	// let's not run out of disk space...
	if b.N > 10000000 {
		b.N = 10000000
	}

	fname := "bench-tmpfile"
	f, err := os.Create(fname)
	if err != nil {
		b.Fatal(err)
	}
	defer func(f *os.File, name string) {
		f.Close()
		os.Remove(name)
	}(f, fname)

	data := make(Blobs, b.N)

	for i := range data {
		data[i].Name = blobstrings[prand.Intn(len(blobstrings))]
		data[i].Float = blobfloats[prand.Intn(len(blobfloats))]
		data[i].Amount = blobints[prand.Intn(len(blobints))]
		data[i].Bytes = blobbytes[prand.Intn(len(blobbytes))]
	}

	b.SetBytes(int64(data.Msgsize() / b.N))
	b.ResetTimer()
	err = msgp.WriteFile(data, f)
	if err != nil {
		b.Fatal(err)
	}
	err = msgp.ReadFile(&data, f)
	if err != nil {
		b.Fatal(err)
	}
}
