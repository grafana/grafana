package unidecode

import (
	"compress/zlib"
	"encoding/binary"
	"io"
	"strings"
	"sync"
)

var (
	decoded          = false
	mutex            sync.Mutex
	transliterations [65536][]rune
	transCount       = rune(len(transliterations))
	getUint16        = binary.LittleEndian.Uint16
)

func decodeTransliterations() {
	r, err := zlib.NewReader(strings.NewReader(tableData))
	if err != nil {
		panic(err)
	}
	defer r.Close()
	tmp1 := make([]byte, 2)
	tmp2 := tmp1[:1]
	for {
		if _, err := io.ReadAtLeast(r, tmp1, 2); err != nil {
			if err == io.EOF {
				break
			}
			panic(err)
		}
		chr := getUint16(tmp1)
		if _, err := io.ReadAtLeast(r, tmp2, 1); err != nil {
			panic(err)
		}
		b := make([]byte, int(tmp2[0]))
		if _, err := io.ReadFull(r, b); err != nil {
			panic(err)
		}
		transliterations[int(chr)] = []rune(string(b))
	}
}
