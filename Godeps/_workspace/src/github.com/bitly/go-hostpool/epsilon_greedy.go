package hostpool

import (
	"log"
	"math/rand"
	"time"
)

type epsilonHostPoolResponse struct {
	standardHostPoolResponse
	started time.Time
	ended   time.Time
}

func (r *epsilonHostPoolResponse) Mark(err error) {
	r.Do(func() {
		r.ended = time.Now()
		doMark(err, r)
	})
}

type epsilonGreedyHostPool struct {
	standardHostPool               // TODO - would be nifty if we could embed HostPool and Locker interfaces
	epsilon                float32 // this is our exploration factor
	decayDuration          time.Duration
	EpsilonValueCalculator // embed the epsilonValueCalculator
	timer
	quit chan bool
}

// Construct an Epsilon Greedy HostPool
//
// Epsilon Greedy is an algorithm that allows HostPool not only to track failure state,
// but also to learn about "better" options in terms of speed, and to pick from available hosts
// based on how well they perform. This gives a weighted request rate to better
// performing hosts, while still distributing requests to all hosts (proportionate to their performance).
// The interface is the same as the standard HostPool, but be sure to mark the HostResponse immediately
// after executing the request to the host, as that will stop the implicitly running request timer.
//
// A good overview of Epsilon Greedy is here http://stevehanov.ca/blog/index.php?id=132
//
// To compute the weighting scores, we perform a weighted average of recent response times, over the course of
// `decayDuration`. decayDuration may be set to 0 to use the default value of 5 minutes
// We then use the supplied EpsilonValueCalculator to calculate a score from that weighted average response time.
func NewEpsilonGreedy(hosts []string, decayDuration time.Duration, calc EpsilonValueCalculator) HostPool {

	if decayDuration <= 0 {
		decayDuration = defaultDecayDuration
	}
	stdHP := New(hosts).(*standardHostPool)
	p := &epsilonGreedyHostPool{
		standardHostPool:       *stdHP,
		epsilon:                float32(initialEpsilon),
		decayDuration:          decayDuration,
		EpsilonValueCalculator: calc,
		timer: &realTimer{},
		quit:  make(chan bool),
	}

	// allocate structures
	for _, h := range p.hostList {
		h.epsilonCounts = make([]int64, epsilonBuckets)
		h.epsilonValues = make([]int64, epsilonBuckets)
	}
	go p.epsilonGreedyDecay()
	return p
}

func (p *epsilonGreedyHostPool) Close() {
	// No need to do p.quit <- true as close(p.quit) does the trick.
	close(p.quit)
}

func (p *epsilonGreedyHostPool) SetEpsilon(newEpsilon float32) {
	p.Lock()
	defer p.Unlock()
	p.epsilon = newEpsilon
}

func (p *epsilonGreedyHostPool) epsilonGreedyDecay() {
	durationPerBucket := p.decayDuration / epsilonBuckets
	ticker := time.NewTicker(durationPerBucket)
	for {
		select {
		case <-p.quit:
			ticker.Stop()
			return
		case <-ticker.C:
			p.performEpsilonGreedyDecay()
		}
	}
}
func (p *epsilonGreedyHostPool) performEpsilonGreedyDecay() {
	p.Lock()
	for _, h := range p.hostList {
		h.epsilonIndex += 1
		h.epsilonIndex = h.epsilonIndex % epsilonBuckets
		h.epsilonCounts[h.epsilonIndex] = 0
		h.epsilonValues[h.epsilonIndex] = 0
	}
	p.Unlock()
}

func (p *epsilonGreedyHostPool) Get() HostPoolResponse {
	p.Lock()
	defer p.Unlock()
	host := p.getEpsilonGreedy()
	started := time.Now()
	return &epsilonHostPoolResponse{
		standardHostPoolResponse: standardHostPoolResponse{host: host, pool: p},
		started:                  started,
	}
}

func (p *epsilonGreedyHostPool) getEpsilonGreedy() string {
	var hostToUse *hostEntry

	// this is our exploration phase
	if rand.Float32() < p.epsilon {
		p.epsilon = p.epsilon * epsilonDecay
		if p.epsilon < minEpsilon {
			p.epsilon = minEpsilon
		}
		return p.getRoundRobin()
	}

	// calculate values for each host in the 0..1 range (but not ormalized)
	var possibleHosts []*hostEntry
	now := time.Now()
	var sumValues float64
	for _, h := range p.hostList {
		if h.canTryHost(now) {
			v := h.getWeightedAverageResponseTime()
			if v > 0 {
				ev := p.CalcValueFromAvgResponseTime(v)
				h.epsilonValue = ev
				sumValues += ev
				possibleHosts = append(possibleHosts, h)
			}
		}
	}

	if len(possibleHosts) != 0 {
		// now normalize to the 0..1 range to get a percentage
		for _, h := range possibleHosts {
			h.epsilonPercentage = h.epsilonValue / sumValues
		}

		// do a weighted random choice among hosts
		ceiling := 0.0
		pickPercentage := rand.Float64()
		for _, h := range possibleHosts {
			ceiling += h.epsilonPercentage
			if pickPercentage <= ceiling {
				hostToUse = h
				break
			}
		}
	}

	if hostToUse == nil {
		if len(possibleHosts) != 0 {
			log.Println("Failed to randomly choose a host, Dan loses")
		}
		return p.getRoundRobin()
	}

	if hostToUse.dead {
		hostToUse.willRetryHost(p.maxRetryInterval)
	}
	return hostToUse.host
}

func (p *epsilonGreedyHostPool) markSuccess(hostR HostPoolResponse) {
	// first do the base markSuccess - a little redundant with host lookup but cleaner than repeating logic
	p.standardHostPool.markSuccess(hostR)
	eHostR, ok := hostR.(*epsilonHostPoolResponse)
	if !ok {
		log.Printf("Incorrect type in eps markSuccess!") // TODO reflection to print out offending type
		return
	}
	host := eHostR.host
	duration := p.between(eHostR.started, eHostR.ended)

	p.Lock()
	defer p.Unlock()
	h, ok := p.hosts[host]
	if !ok {
		log.Fatalf("host %s not in HostPool %v", host, p.Hosts())
	}
	h.epsilonCounts[h.epsilonIndex]++
	h.epsilonValues[h.epsilonIndex] += int64(duration.Seconds() * 1000)
}

// --- timer: this just exists for testing

type timer interface {
	between(time.Time, time.Time) time.Duration
}

type realTimer struct{}

func (rt *realTimer) between(start time.Time, end time.Time) time.Duration {
	return end.Sub(start)
}
