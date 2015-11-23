// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"fmt"
	hostpool "github.com/bitly/go-hostpool"
	"net/http"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	Version         = "0.0.2"
	DefaultProtocol = "http"
	DefaultDomain   = "localhost"
	DefaultPort     = "9200"
	// A decay duration of zero results in the default behaviour
	DefaultDecayDuration = 0
)

type Conn struct {
	// Maintain these for backwards compatibility
	Protocol       string
	Domain         string
	ClusterDomains []string
	Port           string
	Username       string
	Password       string
	Hosts          []string
	hp             hostpool.HostPool
	once           sync.Once

	// To compute the weighting scores, we perform a weighted average of recent response times,
	// over the course of `DecayDuration`. DecayDuration may be set to 0 to use the default
	// value of 5 minutes. The EpsilonValueCalculator uses this to calculate a score
	// from the weighted average response time.
	DecayDuration time.Duration
}

func NewConn() *Conn {
	return &Conn{
		// Maintain these for backwards compatibility
		Protocol:       DefaultProtocol,
		Domain:         DefaultDomain,
		ClusterDomains: []string{DefaultDomain},
		Port:           DefaultPort,
		DecayDuration:  time.Duration(DefaultDecayDuration * time.Second),
	}
}

func (c *Conn) SetPort(port string) {
    c.Port = port
}

func (c *Conn) SetHosts(newhosts []string) {

	// Store the new host list
	c.Hosts = newhosts

	// Reinitialise the host pool Pretty naive as this will nuke the current
	// hostpool, and therefore reset any scoring
	c.initializeHostPool()
}

// Set up the host pool to be used
func (c *Conn) initializeHostPool() {

	// If no hosts are set, fallback to defaults
	if len(c.Hosts) == 0 {
		c.Hosts = append(c.Hosts, fmt.Sprintf("%s:%s", c.Domain, c.Port))
	}

	// Epsilon Greedy is an algorithm that allows HostPool not only to
	// track failure state, but also to learn about "better" options in
	// terms of speed, and to pick from available hosts based on how well
	// they perform. This gives a weighted request rate to better
	// performing hosts, while still distributing requests to all hosts
	// (proportionate to their performance).  The interface is the same as
	// the standard HostPool, but be sure to mark the HostResponse
	// immediately after executing the request to the host, as that will
	// stop the implicitly running request timer.
	//
	// A good overview of Epsilon Greedy is here http://stevehanov.ca/blog/index.php?id=132
	c.hp = hostpool.NewEpsilonGreedy(
		c.Hosts, c.DecayDuration, &hostpool.LinearEpsilonValueCalculator{})
}

func (c *Conn) NewRequest(method, path, query string) (*Request, error) {
	// Setup the hostpool on our first run
	c.once.Do(c.initializeHostPool)

	// Get a host from the host pool
	hr := c.hp.Get()

	// Get the final host and port
	host, portNum := splitHostnamePartsFromHost(hr.Host(), c.Port)

	// Build request
	var uri string
	// If query parameters are provided, the add them to the URL,
	// otherwise, leave them out
	if len(query) > 0 {
		uri = fmt.Sprintf("%s://%s:%s%s?%s", c.Protocol, host, portNum, path, query)
	} else {
		uri = fmt.Sprintf("%s://%s:%s%s", c.Protocol, host, portNum, path)
	}
	req, err := http.NewRequest(method, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Accept", "application/json")
	req.Header.Add("User-Agent", "elasticSearch/"+Version+" ("+runtime.GOOS+"-"+runtime.GOARCH+")")

	if c.Username != "" || c.Password != "" {
		req.SetBasicAuth(c.Username, c.Password)
	}

	newRequest := &Request{
		Request:      req,
		hostResponse: hr,
	}
	return newRequest, nil
}

// Split apart the hostname on colon
// Return the host and a default port if there is no separator
func splitHostnamePartsFromHost(fullHost string, defaultPortNum string) (string, string) {

	h := strings.Split(fullHost, ":")

	if len(h) == 2 {
		return h[0], h[1]
	}

	return h[0], defaultPortNum
}
