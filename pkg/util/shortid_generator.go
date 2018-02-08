package util

import (
	"github.com/teris-io/shortid"
)

func init() {
	gen, _ := shortid.New(1, shortid.DefaultABC, 1)
	shortid.SetDefault(gen)
}

// GenerateShortUid generates a short unique identifier.
func GenerateShortUid() string {
	return shortid.MustGenerate()
}
