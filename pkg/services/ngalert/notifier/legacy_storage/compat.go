package legacy_storage

import (
	"fmt"
	"hash/fnv"
)

func GetUID(name string) string {
	sum := fnv.New64()
	_, _ = sum.Write([]byte(name))
	return fmt.Sprintf("%016x", sum.Sum64())
}
