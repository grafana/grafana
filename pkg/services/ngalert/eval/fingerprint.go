// This code is copied from https://github.com/grafana/grafana-plugin-sdk-go
package eval

import (
	"fmt"
	"hash/fnv"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type fingerprint uint64

func (f fingerprint) String() string {
	return fmt.Sprintf("%016x", uint64(f))
}

// Fingerprint calculates a 64-bit FNV-1 hash of the labels. Labels are sorted by key to make sure the hash is stable.
func fingerprintLabels(l data.Labels) fingerprint {
	h := fnv.New64()
	if len(l) == 0 {
		return fingerprint(h.Sum64())
	}
	// maps do not guarantee predictable sequence of keys.
	// Therefore, to make hash stable, we need to sort keys
	keys := make([]string, 0, len(l))
	for labelName := range l {
		keys = append(keys, labelName)
	}
	sort.Strings(keys)
	for _, name := range keys {
		_, _ = h.Write([]byte(name))
		// ignore errors returned by Write method because fnv never returns them.
		_, _ = h.Write([]byte{255}) // use an invalid utf-8 sequence as separator
		value := l[name]
		_, _ = h.Write([]byte(value))
		_, _ = h.Write([]byte{255})
	}
	return fingerprint(h.Sum64())
}
