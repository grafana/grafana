package testdata

import (
	"math/rand"
	"time"
)

type randomStringProvider struct {
	r    *rand.Rand
	data []string
}

func newRandomStringProvider(data []string) *randomStringProvider {
	return &randomStringProvider{
		r:    rand.New(rand.NewSource(time.Now().UnixNano())),
		data: data,
	}
}

func (p *randomStringProvider) Next() string {
	return p.data[p.r.Int31n(int32(len(p.data)))]
}
