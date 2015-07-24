package hostpool

import (
	"github.com/bitly/go-hostpool"
)

func ExampleNewEpsilonGreedy() {
	hp := hostpool.NewEpsilonGreedy([]string{"a", "b"}, 0, &hostpool.LinearEpsilonValueCalculator{})
	hostResponse := hp.Get()
	hostname := hostResponse.Host()
	err := nil // (make a request with hostname)
	hostResponse.Mark(err)
}
