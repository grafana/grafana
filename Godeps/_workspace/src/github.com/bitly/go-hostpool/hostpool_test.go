package hostpool

import (
	"errors"
	"github.com/bmizerany/assert"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"testing"
	"time"
)

func TestHostPool(t *testing.T) {
	log.SetOutput(ioutil.Discard)
	defer log.SetOutput(os.Stdout)

	dummyErr := errors.New("Dummy Error")

	p := New([]string{"a", "b", "c"})
	assert.Equal(t, p.Get().Host(), "a")
	assert.Equal(t, p.Get().Host(), "b")
	assert.Equal(t, p.Get().Host(), "c")
	respA := p.Get()
	assert.Equal(t, respA.Host(), "a")

	respA.Mark(dummyErr)
	respB := p.Get()
	respB.Mark(dummyErr)
	respC := p.Get()
	assert.Equal(t, respC.Host(), "c")
	respC.Mark(nil)
	// get again, and verify that it's still c
	assert.Equal(t, p.Get().Host(), "c")
	// now try to mark b as success; should fail because already marked
	respB.Mark(nil)
	assert.Equal(t, p.Get().Host(), "c") // would be b if it were not dead
	// now restore a
	respA = &standardHostPoolResponse{host: "a", pool: p}
	respA.Mark(nil)
	assert.Equal(t, p.Get().Host(), "a")
	assert.Equal(t, p.Get().Host(), "c")

	// ensure that we get *something* back when all hosts fail
	for _, host := range []string{"a", "b", "c"} {
		response := &standardHostPoolResponse{host: host, pool: p}
		response.Mark(dummyErr)
	}
	resp := p.Get()
	assert.NotEqual(t, resp, nil)
}

type mockTimer struct {
	t int // the time it will always return
}

func (t *mockTimer) between(start time.Time, end time.Time) time.Duration {
	return time.Duration(t.t) * time.Millisecond
}

func TestEpsilonGreedy(t *testing.T) {
	log.SetOutput(ioutil.Discard)
	defer log.SetOutput(os.Stdout)

	rand.Seed(10)

	iterations := 12000
	p := NewEpsilonGreedy([]string{"a", "b"}, 0, &LinearEpsilonValueCalculator{}).(*epsilonGreedyHostPool)

	timings := make(map[string]int64)
	timings["a"] = 200
	timings["b"] = 300

	hitCounts := make(map[string]int)
	hitCounts["a"] = 0
	hitCounts["b"] = 0

	log.Printf("starting first run (a, b)")

	for i := 0; i < iterations; i += 1 {
		if i != 0 && i%100 == 0 {
			p.performEpsilonGreedyDecay()
		}
		hostR := p.Get()
		host := hostR.Host()
		hitCounts[host]++
		timing := timings[host]
		p.timer = &mockTimer{t: int(timing)}
		hostR.Mark(nil)
	}

	for host := range hitCounts {
		log.Printf("host %s hit %d times (%0.2f percent)", host, hitCounts[host], (float64(hitCounts[host])/float64(iterations))*100.0)
	}

	assert.Equal(t, hitCounts["a"] > hitCounts["b"], true)

	hitCounts["a"] = 0
	hitCounts["b"] = 0
	log.Printf("starting second run (b, a)")
	timings["a"] = 500
	timings["b"] = 100

	for i := 0; i < iterations; i += 1 {
		if i != 0 && i%100 == 0 {
			p.performEpsilonGreedyDecay()
		}
		hostR := p.Get()
		host := hostR.Host()
		hitCounts[host]++
		timing := timings[host]
		p.timer = &mockTimer{t: int(timing)}
		hostR.Mark(nil)
	}

	for host := range hitCounts {
		log.Printf("host %s hit %d times (%0.2f percent)", host, hitCounts[host], (float64(hitCounts[host])/float64(iterations))*100.0)
	}

	assert.Equal(t, hitCounts["b"] > hitCounts["a"], true)
}

func BenchmarkEpsilonGreedy(b *testing.B) {
	b.StopTimer()

	// Make up some response times
	zipfDist := rand.NewZipf(rand.New(rand.NewSource(0)), 1.1, 5, 5000)
	timings := make([]uint64, b.N)
	for i := 0; i < b.N; i++ {
		timings[i] = zipfDist.Uint64()
	}

	// Make the hostpool with a few hosts
	p := NewEpsilonGreedy([]string{"a", "b"}, 0, &LinearEpsilonValueCalculator{}).(*epsilonGreedyHostPool)

	b.StartTimer()
	for i := 0; i < b.N; i++ {
		if i != 0 && i%100 == 0 {
			p.performEpsilonGreedyDecay()
		}
		hostR := p.Get()
		p.timer = &mockTimer{t: int(timings[i])}
		hostR.Mark(nil)
	}
}
