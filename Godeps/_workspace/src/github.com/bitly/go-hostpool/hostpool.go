// A Go package to intelligently and flexibly pool among multiple hosts from your Go application.
// Host selection can operate in round robin or epsilon greedy mode, and unresponsive hosts are
// avoided. A good overview of Epsilon Greedy is here http://stevehanov.ca/blog/index.php?id=132
package hostpool

import (
	"log"
	"sync"
	"time"
)

// Returns current version
func Version() string {
	return "0.1"
}

// --- Response interfaces and structs ----

// This interface represents the response from HostPool. You can retrieve the
// hostname by calling Host(), and after making a request to the host you should
// call Mark with any error encountered, which will inform the HostPool issuing
// the HostPoolResponse of what happened to the request and allow it to update.
type HostPoolResponse interface {
	Host() string
	Mark(error)
	hostPool() HostPool
}

type standardHostPoolResponse struct {
	host string
	sync.Once
	pool HostPool
}

// --- HostPool structs and interfaces ----

// This is the main HostPool interface. Structs implementing this interface
// allow you to Get a HostPoolResponse (which includes a hostname to use),
// get the list of all Hosts, and use ResetAll to reset state.
type HostPool interface {
	Get() HostPoolResponse
	// keep the marks separate so we can override independently
	markSuccess(HostPoolResponse)
	markFailed(HostPoolResponse)

	ResetAll()
	Hosts() []string

	// Close the hostpool and release all resources.
	Close()
}

type standardHostPool struct {
	sync.RWMutex
	hosts             map[string]*hostEntry
	hostList          []*hostEntry
	initialRetryDelay time.Duration
	maxRetryInterval  time.Duration
	nextHostIndex     int
}

// ------ constants -------------------

const epsilonBuckets = 120
const epsilonDecay = 0.90 // decay the exploration rate
const minEpsilon = 0.01   // explore one percent of the time
const initialEpsilon = 0.3
const defaultDecayDuration = time.Duration(5) * time.Minute

// Construct a basic HostPool using the hostnames provided
func New(hosts []string) HostPool {
	p := &standardHostPool{
		hosts:             make(map[string]*hostEntry, len(hosts)),
		hostList:          make([]*hostEntry, len(hosts)),
		initialRetryDelay: time.Duration(30) * time.Second,
		maxRetryInterval:  time.Duration(900) * time.Second,
	}

	for i, h := range hosts {
		e := &hostEntry{
			host:       h,
			retryDelay: p.initialRetryDelay,
		}
		p.hosts[h] = e
		p.hostList[i] = e
	}

	return p
}

func (r *standardHostPoolResponse) Host() string {
	return r.host
}

func (r *standardHostPoolResponse) hostPool() HostPool {
	return r.pool
}

func (r *standardHostPoolResponse) Mark(err error) {
	r.Do(func() {
		doMark(err, r)
	})
}

func doMark(err error, r HostPoolResponse) {
	if err == nil {
		r.hostPool().markSuccess(r)
	} else {
		r.hostPool().markFailed(r)
	}
}

// return an entry from the HostPool
func (p *standardHostPool) Get() HostPoolResponse {
	p.Lock()
	defer p.Unlock()
	host := p.getRoundRobin()
	return &standardHostPoolResponse{host: host, pool: p}
}

func (p *standardHostPool) getRoundRobin() string {
	now := time.Now()
	hostCount := len(p.hostList)
	for i := range p.hostList {
		// iterate via sequenece from where we last iterated
		currentIndex := (i + p.nextHostIndex) % hostCount

		h := p.hostList[currentIndex]
		if !h.dead {
			p.nextHostIndex = currentIndex + 1
			return h.host
		}
		if h.nextRetry.Before(now) {
			h.willRetryHost(p.maxRetryInterval)
			p.nextHostIndex = currentIndex + 1
			return h.host
		}
	}

	// all hosts are down. re-add them
	p.doResetAll()
	p.nextHostIndex = 0
	return p.hostList[0].host
}

func (p *standardHostPool) ResetAll() {
	p.Lock()
	defer p.Unlock()
	p.doResetAll()
}

// this actually performs the logic to reset,
// and should only be called when the lock has
// already been acquired
func (p *standardHostPool) doResetAll() {
	for _, h := range p.hosts {
		h.dead = false
	}
}

func (p *standardHostPool) Close() {
	for _, h := range p.hosts {
		h.dead = true
	}
}

func (p *standardHostPool) markSuccess(hostR HostPoolResponse) {
	host := hostR.Host()
	p.Lock()
	defer p.Unlock()

	h, ok := p.hosts[host]
	if !ok {
		log.Fatalf("host %s not in HostPool %v", host, p.Hosts())
	}
	h.dead = false
}

func (p *standardHostPool) markFailed(hostR HostPoolResponse) {
	host := hostR.Host()
	p.Lock()
	defer p.Unlock()
	h, ok := p.hosts[host]
	if !ok {
		log.Fatalf("host %s not in HostPool %v", host, p.Hosts())
	}
	if !h.dead {
		h.dead = true
		h.retryCount = 0
		h.retryDelay = p.initialRetryDelay
		h.nextRetry = time.Now().Add(h.retryDelay)
	}

}
func (p *standardHostPool) Hosts() []string {
	hosts := make([]string, 0, len(p.hosts))
	for host := range p.hosts {
		hosts = append(hosts, host)
	}
	return hosts
}
