package rand

import (
	"math/rand/v2"
)

type Rand struct {
}

func ProvideRand() *Rand {
	return &Rand{}
}

// Impl of contracts.Rand

func (r *Rand) Int64N(n int64) int64 {
	return rand.Int64N(n)
}
