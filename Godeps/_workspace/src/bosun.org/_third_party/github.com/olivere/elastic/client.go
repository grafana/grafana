// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// Version is the current version of Elastic.
	Version = "2.0.0.alpha1"

	// DefaultUrl is the default endpoint of Elasticsearch on the local machine.
	// It is used e.g. when initializing a new Client without a specific URL.
	DefaultURL = "http://127.0.0.1:9200"

	// DefaultScheme is the default protocol scheme to use when sniffing
	// the Elasticsearch cluster.
	DefaultScheme = "http"

	// DefaultHealthcheckEnabled specifies if healthchecks are enabled by default.
	DefaultHealthcheckEnabled = true

	// DefaultHealthcheckInterval is the default interval between
	// two health checks of the nodes in the cluster.
	DefaultHealthcheckInterval = 60 * time.Second

	// DefaultSnifferEnabled specifies if the sniffer is enabled by default.
	DefaultSnifferEnabled = true

	// DefaultSnifferInterval is the interval between two sniffing procedures,
	// i.e. the lookup of all nodes in the cluster and their addition/removal
	// from the list of actual connections.
	DefaultSnifferInterval = 15 * time.Minute

	// DefaultSnifferTimeout is the default timeout after which the
	// sniffing process times out.
	DefaultSnifferTimeout = 1 * time.Second

	// DefaultMaxRetries is the number of retries for a single request after
	// Elastic will give up and return an error. It is zero by default, so
	// retry is disabled by default.
	DefaultMaxRetries = 0
)

var (
	// ErrNoClient is raised when no Elasticsearch node is available.
	ErrNoClient = errors.New("no Elasticsearch node available")

	// ErrRetry is raised when a request cannot be executed after the configured
	// number of retries.
	ErrRetry = errors.New("cannot connect after several retries")
)

// ClientOptionFunc is a function that configures a Client.
// It is used in NewClient.
type ClientOptionFunc func(*Client) error

// Client is an Elasticsearch client. Create one by calling NewClient.
type Client struct {
	c *http.Client // net/http Client to use for requests

	connsMu sync.RWMutex // connsMu guards the next block
	conns   []*conn      // all connections
	cindex  int          // index into conns

	mu                  sync.RWMutex  // guards the next block
	urls                []string      // set of URLs passed initially to the client
	running             bool          // true if the client's background processes are running
	errorlog            *log.Logger   // error log for critical messages
	infolog             *log.Logger   // information log for e.g. response times
	tracelog            *log.Logger   // trace log for debugging
	maxRetries          int           // max. number of retries
	scheme              string        // http or https
	healthcheckEnabled  bool          // healthchecks enabled or disabled
	healthcheckInterval time.Duration // interval between healthchecks
	healthcheckStop     chan bool     // notify healthchecker to stop, and notify back
	snifferEnabled      bool          // sniffer enabled or disabled
	snifferTimeout      time.Duration // time the sniffer waits for a response from nodes info API
	snifferInterval     time.Duration // interval between sniffing
	snifferStop         chan bool     // notify sniffer to stop, and notify back
	decoder             Decoder       // used to decode data sent from Elasticsearch
}

// NewClient creates a new client to work with Elasticsearch.
//
// The caller can configure the new client by passing configuration options
// to the func.
//
// Example:
//
//   client, err := elastic.NewClient(
//     elastic.SetURL("http://localhost:9200", "http://localhost:9201"),
//     elastic.SetMaxRetries(10))
//
// If no URL is configured, Elastic uses DefaultURL by default.
//
// If the sniffer is enabled (the default), the new client then sniffes
// the cluster via the Nodes Info API
// (see http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/cluster-nodes-info.html#cluster-nodes-info).
// It uses the URLs specified by the caller. The caller is responsible
// to only pass a list of URLs of nodes that belong to the same cluster.
// This sniffing process is run on startup and periodically.
// Use SnifferInterval to set the interval between two sniffs (default is
// 15 minutes). In other words: By default, the client will find new nodes
// in the cluster and remove those that are no longer available every
// 15 minutes. Disable the sniffer by passing SetSniff(false) to NewClient.
//
// The list of nodes found in the sniffing process will be used to make
// connections to the REST API of Elasticsearch. These nodes are also
// periodically checked in a shorter time frame. This process is called
// a health check. By default, a health check is done every 60 seconds.
// You can set a shorter or longer interval by SetHealthcheckInterval.
// Disabling health checks is not recommended, but can be done by
// SetHealthcheck(false).
//
// Connections are automatically marked as dead or healthy while
// making requests to Elasticsearch. When a request fails, Elastic will
// retry up to a maximum number of retries configured with SetMaxRetries.
// Retries are disabled by default.
//
// If no HttpClient is configured, then http.DefaultClient is used.
// You can use your own http.Client with some http.Transport for
// advanced scenarios.
//
// An error is also returned when some configuration option is invalid or
// the new client cannot sniff the cluster (if enabled).
func NewClient(options ...ClientOptionFunc) (*Client, error) {
	// Set up the client
	c := &Client{
		urls:                []string{DefaultURL},
		c:                   http.DefaultClient,
		conns:               make([]*conn, 0),
		cindex:              -1,
		scheme:              DefaultScheme,
		decoder:             &DefaultDecoder{},
		maxRetries:          DefaultMaxRetries,
		healthcheckEnabled:  DefaultHealthcheckEnabled,
		healthcheckInterval: DefaultHealthcheckInterval,
		healthcheckStop:     make(chan bool),
		snifferEnabled:      DefaultSnifferEnabled,
		snifferInterval:     DefaultSnifferInterval,
		snifferStop:         make(chan bool),
		snifferTimeout:      DefaultSnifferTimeout,
	}

	// Run the options on it
	for _, option := range options {
		if err := option(c); err != nil {
			return nil, err
		}
	}

	if len(c.urls) == 0 {
		c.urls = []string{DefaultURL}
	}
	c.urls = canonicalize(c.urls...)

	if c.snifferEnabled {
		// Sniff the cluster initially
		if err := c.sniff(); err != nil {
			return nil, err
		}
	} else {
		// Do not sniff the cluster initially. Use the provided URLs instead.
		for _, url := range c.urls {
			c.conns = append(c.conns, newConn(url, url))
		}
	}

	// Perform an initial health check
	c.healthcheck()

	go c.sniffer()       // periodically update cluster information
	go c.healthchecker() // start goroutine periodically ping all nodes of the cluster

	c.mu.Lock()
	c.running = true
	c.mu.Unlock()

	return c, nil
}

// SetHttpClient can be used to specify the http.Client to use when making
// HTTP requests to Elasticsearch.
func SetHttpClient(httpClient *http.Client) ClientOptionFunc {
	return func(c *Client) error {
		if httpClient != nil {
			c.c = httpClient
		} else {
			c.c = http.DefaultClient
		}
		return nil
	}
}

// SetURL defines the URL endpoints of the Elasticsearch nodes. Notice that
// when sniffing is enabled, these URLs are used to initially sniff the
// cluster on startup.
func SetURL(urls ...string) ClientOptionFunc {
	return func(c *Client) error {
		switch len(urls) {
		case 0:
			c.urls = []string{DefaultURL}
		default:
			c.urls = make([]string, 0)
			for _, url := range urls {
				c.urls = append(c.urls, url)
			}
		}
		return nil
	}
}

// SetScheme sets the HTTP scheme to look for when sniffing (http or https).
// This is http by default.
func SetScheme(scheme string) ClientOptionFunc {
	return func(c *Client) error {
		c.scheme = scheme
		return nil
	}
}

// SetSniff enables or disables the sniffer (enabled by default).
func SetSniff(enabled bool) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferEnabled = enabled
		return nil
	}
}

// SetSnifferInterval sets the interval between two sniffing processes.
// The default interval is 15 minutes.
func SetSnifferInterval(interval time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferInterval = interval
		return nil
	}
}

// SetSnifferTimeout sets the timeout for the sniffer that finds the
// nodes in a cluster. The default is 1 second.
func SetSnifferTimeout(timeout time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferTimeout = timeout
		return nil
	}
}

// SetHealthcheck enables or disables healthchecks (enabled by default).
func SetHealthcheck(enabled bool) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckEnabled = enabled
		return nil
	}
}

// SetHealthcheckInterval sets the interval between two health checks.
// The default interval is 60 seconds.
func SetHealthcheckInterval(interval time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckInterval = interval
		return nil
	}
}

// SetMaxRetries sets the maximum number of retries before giving up when
// performing a HTTP request to Elasticsearch.
func SetMaxRetries(maxRetries int) func(*Client) error {
	return func(c *Client) error {
		if maxRetries < 0 {
			return errors.New("MaxRetries must be greater than or equal to 0")
		}
		c.maxRetries = maxRetries
		return nil
	}
}

// SetDecoder sets the Decoder to use when decoding data from Elasticsearch.
// DefaultDecoder is used by default.
func SetDecoder(decoder Decoder) func(*Client) error {
	return func(c *Client) error {
		if decoder != nil {
			c.decoder = decoder
		} else {
			c.decoder = &DefaultDecoder{}
		}
		return nil
	}
}

// SetErrorLog sets the logger for critical messages like nodes joining
// or leaving the cluster or failing requests. It is nil by default.
func SetErrorLog(logger *log.Logger) func(*Client) error {
	return func(c *Client) error {
		c.errorlog = logger
		return nil
	}
}

// SetInfoLog sets the logger for informational messages, e.g. requests
// and their response times. It is nil by default.
func SetInfoLog(logger *log.Logger) func(*Client) error {
	return func(c *Client) error {
		c.infolog = logger
		return nil
	}
}

// SetTraceLog specifies the log.Logger to use for output of HTTP requests
// and responses which is helpful during debugging. It is nil by default.
func SetTraceLog(logger *log.Logger) func(*Client) error {
	return func(c *Client) error {
		c.tracelog = logger
		return nil
	}
}

// String returns a string representation of the client status.
func (c *Client) String() string {
	c.connsMu.Lock()
	conns := c.conns
	c.connsMu.Unlock()

	var buf bytes.Buffer
	for i, conn := range conns {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(conn.String())
	}
	return buf.String()
}

// IsRunning returns true if the background processes of the client are
// running, false otherwise.
func (c *Client) IsRunning() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.running
}

// Start starts the background processes like sniffing the cluster and
// periodic health checks. You don't need to run Start when creating a
// client with NewClient; the background processes are run by default.
//
// If the background processes are already running, this is a no-op.
func (c *Client) Start() {
	c.mu.RLock()
	if c.running {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	go c.sniffer()
	go c.healthchecker()

	c.mu.Lock()
	c.running = true
	c.mu.Unlock()

	c.infof("elastic: client started")
}

// Stop stops the background processes that the client is running,
// i.e. sniffing the cluster periodically and running health checks
// on the nodes.
//
// If the background processes are not running, this is a no-op.
func (c *Client) Stop() {
	c.mu.RLock()
	if !c.running {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	c.healthcheckStop <- true
	<-c.healthcheckStop

	c.snifferStop <- true
	<-c.snifferStop

	c.mu.Lock()
	c.running = false
	c.mu.Unlock()

	c.infof("elastic: client stopped")
}

// errorf logs to the error log.
func (c *Client) errorf(format string, args ...interface{}) {
	if c.errorlog != nil {
		c.errorlog.Printf(format, args...)
	}
}

// infof logs informational messages.
func (c *Client) infof(format string, args ...interface{}) {
	if c.infolog != nil {
		c.infolog.Printf(format, args...)
	}
}

// tracef logs to the trace log.
func (c *Client) tracef(format string, args ...interface{}) {
	if c.tracelog != nil {
		c.tracelog.Printf(format, args...)
	}
}

// dumpRequest dumps the given HTTP request to the trace log.
func (c *Client) dumpRequest(r *http.Request) {
	if c.tracelog != nil {
		out, err := httputil.DumpRequestOut(r, true)
		if err == nil {
			c.tracef("%s\n", string(out))
		}
	}
}

// dumpResponse dumps the given HTTP response to the trace log.
func (c *Client) dumpResponse(resp *http.Response) {
	if c.tracelog != nil {
		out, err := httputil.DumpResponse(resp, true)
		if err == nil {
			c.tracef("%s\n", string(out))
		}
	}
}

// sniffer periodically runs sniff.
func (c *Client) sniffer() {
	for {
		c.mu.RLock()
		ticker := time.NewTicker(c.snifferInterval)
		c.mu.RUnlock()

		select {
		case <-c.snifferStop:
			// we are asked to stop, so we signal back that we're stopping now
			c.snifferStop <- true
			return
		case <-ticker.C:
			c.sniff()
		}
	}
}

// sniff uses the Node Info API to return the list of nodes in the cluster.
// It uses the list of URLs passed on startup plus the list of URLs found
// by the preceding sniffing process (if sniffing is enabled).
//
// If sniffing is disabled, this is a no-op.
func (c *Client) sniff() error {
	c.mu.RLock()
	if !c.snifferEnabled {
		c.mu.RUnlock()
		return nil
	}

	// Use all available URLs provided to sniff the cluster.
	urlsMap := make(map[string]bool)
	urls := make([]string, 0)

	// Add all URLs provided on startup
	for _, url := range c.urls {
		urlsMap[url] = true
		urls = append(urls, url)
	}
	timeout := c.snifferTimeout
	c.mu.RUnlock()

	// Add all URLs found by sniffing
	c.connsMu.RLock()
	for _, conn := range c.conns {
		if !conn.IsDead() {
			url := conn.URL()
			if _, found := urlsMap[url]; !found {
				urls = append(urls, url)
			}
		}
	}
	c.connsMu.RUnlock()

	if len(urls) == 0 {
		return ErrNoClient
	}

	// Start sniffing on all found URLs
	ch := make(chan []*conn, len(urls))
	for _, url := range urls {
		go func(url string) { ch <- c.sniffNode(url) }(url)
	}

	// Wait for the results to come back, or the process times out.
	for {
		select {
		case conns := <-ch:
			if len(conns) > 0 {
				c.updateConns(conns)
				return nil
			}
		case <-time.After(timeout):
			// We get here if no cluster responds in time
			return ErrNoClient
		}
	}
}

// reSniffHostAndPort is used to extract hostname and port from a result
// from a Nodes Info API (example: "inet[/127.0.0.1:9200]").
var reSniffHostAndPort = regexp.MustCompile(`\/([^:]*):([0-9]+)\]`)

// sniffNode sniffs a single node. This method is run as a goroutine
// in sniff. If successful, it returns the list of node URLs extracted
// from the result of calling Nodes Info API. Otherwise, an empty array
// is returned.
func (c *Client) sniffNode(url string) []*conn {
	nodes := make([]*conn, 0)

	// Call the Nodes Info API at /_nodes/http
	req, err := NewRequest("GET", url+"/_nodes/http")
	if err != nil {
		return nodes
	}

	res, err := c.c.Do((*http.Request)(req))
	if err != nil {
		return nodes
	}
	if res == nil {
		return nodes
	}

	if res.Body != nil {
		defer res.Body.Close()
	}

	var info NodesInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&info); err == nil {
		if len(info.Nodes) > 0 {
			switch c.scheme {
			case "https":
				for nodeID, node := range info.Nodes {
					m := reSniffHostAndPort.FindStringSubmatch(node.HTTPSAddress)
					if len(m) == 3 {
						url := fmt.Sprintf("https://%s:%s", m[1], m[2])
						nodes = append(nodes, newConn(nodeID, url))
					}
				}
			default:
				for nodeID, node := range info.Nodes {
					m := reSniffHostAndPort.FindStringSubmatch(node.HTTPAddress)
					if len(m) == 3 {
						url := fmt.Sprintf("http://%s:%s", m[1], m[2])
						nodes = append(nodes, newConn(nodeID, url))
					}
				}
			}
		}
	}
	return nodes
}

// updateConns updates the clients' connections with new information
// gather by a sniff operation.
func (c *Client) updateConns(conns []*conn) {
	c.connsMu.Lock()

	newConns := make([]*conn, 0)

	// Build up new connections:
	// If we find an existing connection, use that (including no. of failures etc.).
	// If we find a new connection, add it.
	for _, conn := range conns {
		var found bool
		for _, oldConn := range c.conns {
			if oldConn.NodeID() == conn.NodeID() {
				// Take over the old connection
				newConns = append(newConns, oldConn)
				found = true
				break
			}
		}
		if !found {
			// New connection didn't exist, so add it to our list of new conns.
			c.errorf("elastic: %s joined the cluster", conn.URL())
			newConns = append(newConns, conn)
		}
	}

	c.conns = newConns
	c.cindex = -1
	c.connsMu.Unlock()
}

// healthchecker periodically runs healthcheck.
func (c *Client) healthchecker() {
	for {
		c.mu.RLock()
		ticker := time.NewTicker(c.healthcheckInterval)
		c.mu.RUnlock()

		select {
		case <-c.healthcheckStop:
			// we are asked to stop, so we signal back that we're stopping now
			c.healthcheckStop <- true
			return
		case <-ticker.C:
			c.healthcheck()
		}
	}
}

// healthcheck does a health check on all nodes in the cluster. Depending on
// the node state, it marks connections as dead, sets them alive etc.
// If healthchecks are disabled, this is a no-op.
func (c *Client) healthcheck() {
	c.mu.RLock()
	if !c.healthcheckEnabled {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	c.connsMu.RLock()
	conns := c.conns
	c.connsMu.RUnlock()

	for _, conn := range conns {
		params := make(url.Values)
		params.Set("timeout", "1")
		req, err := NewRequest("HEAD", conn.URL()+"/?"+params.Encode())
		if err == nil {
			res, err := c.c.Do((*http.Request)(req))
			if err == nil {
				if res.Body != nil {
					defer res.Body.Close()
				}
				if res.StatusCode >= 200 && res.StatusCode < 300 {
					conn.MarkAsAlive()
				} else {
					conn.MarkAsDead()
					c.errorf("elastic: %s is dead [status=%d]", conn.URL(), res.StatusCode)
				}
			} else {
				c.errorf("elastic: %s is dead", conn.URL())
				conn.MarkAsDead()
			}
		} else {
			c.errorf("elastic: %s is dead", conn.URL())
			conn.MarkAsDead()
		}
	}
}

// next returns the next available connection, or ErrNoClient.
func (c *Client) next() (*conn, error) {
	// We do round-robin here.
	// TODO: This should be a pluggable strategy, like the Selector in the official clients.
	c.connsMu.Lock()
	defer c.connsMu.Unlock()

	i := 0
	numConns := len(c.conns)
	for {
		i += 1
		if i > numConns {
			break // we visited all conns: they all seem to be dead
		}
		c.cindex += 1
		if c.cindex >= numConns {
			c.cindex = 0
		}
		conn := c.conns[c.cindex]
		if !conn.IsDead() {
			return conn, nil
		}
	}

	// TODO: As a last resort, we could try to awake a dead connection here.

	// We tried hard, but there is no node available
	return nil, ErrNoClient
}

// PerformRequest does a HTTP request to Elasticsearch.
// It returns a response and an error on failure.
func (c *Client) PerformRequest(method, path string, params url.Values, body interface{}) (*Response, error) {
	start := time.Now().UTC()

	c.mu.RLock()
	retries := c.maxRetries
	c.mu.RUnlock()

	var err error
	var conn *conn
	var req *Request
	var resp *Response
	var retried bool

	// We wait between retries, using simple exponential back-off.
	// TODO: Make this configurable, including the jitter.
	retryWaitMsec := int64(100 + (rand.Intn(20) - 10))

	for {
		pathWithParams := path
		if len(params) > 0 {
			pathWithParams += "?" + params.Encode()
		}

		// Get a connection
		conn, err = c.next()
		if err == ErrNoClient {
			if !retried {
				// Force a healtcheck as all connections seem to be dead.
				c.healthcheck()
			}
			retries -= 1
			if retries <= 0 {
				return nil, err
			}
			retried = true
			time.Sleep(time.Duration(retryWaitMsec) * time.Millisecond)
			retryWaitMsec += retryWaitMsec
			continue // try again
		}
		if err != nil {
			c.errorf("elastic: cannot get connection from pool")
			return nil, err
		}

		req, err = NewRequest(method, conn.URL()+pathWithParams)
		if err != nil {
			c.errorf("elastic: cannot create request for %s %s: %v", strings.ToUpper(method), conn.URL()+pathWithParams, err)
			return nil, err
		}

		// Set body
		if body != nil {
			switch b := body.(type) {
			case string:
				req.SetBodyString(b)
				break
			default:
				req.SetBodyJson(body)
				break
			}
		}

		// Tracing
		c.dumpRequest((*http.Request)(req))

		// Get response
		res, err := c.c.Do((*http.Request)(req))
		if err != nil {
			retries -= 1
			if retries <= 0 {
				c.errorf("elastic: %s is dead", conn.URL())
				conn.MarkAsDead()
				return nil, err
			}
			retried = true
			time.Sleep(time.Duration(retryWaitMsec) * time.Millisecond)
			retryWaitMsec += retryWaitMsec
			continue // try again
		}
		if res.Body != nil {
			defer res.Body.Close()
		}

		// Check for errors
		if err := checkResponse(res); err != nil {
			retries -= 1
			if retries <= 0 {
				return nil, err
			}
			retried = true
			time.Sleep(time.Duration(retryWaitMsec) * time.Millisecond)
			retryWaitMsec += retryWaitMsec
			continue // try again
		}

		// Tracing
		c.dumpResponse(res)

		// We successfully made a request with this connection
		conn.MarkAsHealthy()

		resp, err = c.newResponse(res)
		if err != nil {
			return nil, err
		}

		break
	}

	duration := time.Now().UTC().Sub(start)
	c.infof("%s %s [status:%d, request:%.3fs]",
		strings.ToUpper(method),
		req.URL,
		resp.StatusCode,
		float64(int64(duration/time.Millisecond))/1000)

	return resp, nil
}

// ElasticsearchVersion returns the version number of Elasticsearch
// running on the given URL.
func (c *Client) ElasticsearchVersion(url string) (string, error) {
	res, _, err := c.Ping().URL(url).Do()
	if err != nil {
		return "", err
	}
	return res.Version.Number, nil
}

// IndexNames returns the names of all indices in the cluster.
func (c *Client) IndexNames() ([]string, error) {
	res, err := c.IndexGetSettings().Index("_all").Do()
	if err != nil {
		return nil, err
	}
	var names []string
	for name, _ := range res {
		names = append(names, name)
	}
	return names, nil
}

// Ping checks if a given node in a cluster exists and (optionally)
// returns some basic information about the Elasticsearch server,
// e.g. the Elasticsearch version number.
func (c *Client) Ping() *PingService {
	return NewPingService(c)
}

// CreateIndex returns a service to create a new index.
func (c *Client) CreateIndex(name string) *CreateIndexService {
	builder := NewCreateIndexService(c)
	builder.Index(name)
	return builder
}

// DeleteIndex returns a service to delete an index.
func (c *Client) DeleteIndex(name string) *DeleteIndexService {
	builder := NewDeleteIndexService(c)
	builder.Index(name)
	return builder
}

// IndexExists allows to check if an index exists.
func (c *Client) IndexExists(name string) *IndexExistsService {
	builder := NewIndexExistsService(c)
	builder.Index(name)
	return builder
}

// OpenIndex opens an index.
func (c *Client) OpenIndex(name string) *OpenIndexService {
	builder := NewOpenIndexService(c)
	builder.Index(name)
	return builder
}

// CloseIndex closes an index.
func (c *Client) CloseIndex(name string) *CloseIndexService {
	builder := NewCloseIndexService(c)
	builder.Index(name)
	return builder
}

// Index a document.
func (c *Client) Index() *IndexService {
	builder := NewIndexService(c)
	return builder
}

// IndexGet retrieves information about one or more indices.
// IndexGet is only available for Elasticsearch 1.4 or later.
func (c *Client) IndexGet() *IndicesGetService {
	builder := NewIndicesGetService(c)
	return builder
}

// IndexGetSettings retrieves settings about one or more indices.
func (c *Client) IndexGetSettings() *IndicesGetSettingsService {
	builder := NewIndicesGetSettingsService(c)
	return builder
}

// Update a document.
func (c *Client) Update() *UpdateService {
	builder := NewUpdateService(c)
	return builder
}

// Delete a document.
func (c *Client) Delete() *DeleteService {
	builder := NewDeleteService(c)
	return builder
}

// DeleteByQuery deletes documents as found by a query.
func (c *Client) DeleteByQuery() *DeleteByQueryService {
	builder := NewDeleteByQueryService(c)
	return builder
}

// Get a document.
func (c *Client) Get() *GetService {
	builder := NewGetService(c)
	return builder
}

// MultiGet retrieves multiple documents in one roundtrip.
func (c *Client) MultiGet() *MultiGetService {
	builder := NewMultiGetService(c)
	return builder
}

// Exists checks if a document exists.
func (c *Client) Exists() *ExistsService {
	builder := NewExistsService(c)
	return builder
}

// Count documents.
func (c *Client) Count(indices ...string) *CountService {
	builder := NewCountService(c)
	builder.Indices(indices...)
	return builder
}

// Search is the entry point for searches.
func (c *Client) Search(indices ...string) *SearchService {
	builder := NewSearchService(c)
	builder.Indices(indices...)
	return builder
}

// MultiSearch is the entry point for multi searches.
func (c *Client) MultiSearch() *MultiSearchService {
	return NewMultiSearchService(c)
}

// Suggest returns a service to return suggestions.
func (c *Client) Suggest(indices ...string) *SuggestService {
	builder := NewSuggestService(c)
	builder.Indices(indices...)
	return builder
}

// Scan through documents. Use this to iterate inside a server process
// where the results will be processed without returning them to a client.
func (c *Client) Scan(indices ...string) *ScanService {
	builder := NewScanService(c)
	builder.Indices(indices...)
	return builder
}

// Scroll through documents. Use this to efficiently scroll through results
// while returning the results to a client. Use Scan when you don't need
// to return requests to a client (i.e. not paginating via request/response).
func (c *Client) Scroll(indices ...string) *ScrollService {
	builder := NewScrollService(c)
	builder.Indices(indices...)
	return builder
}

// ClearScroll can be used to clear search contexts manually.
func (c *Client) ClearScroll() *ClearScrollService {
	builder := NewClearScrollService(c)
	return builder
}

// Optimize asks Elasticsearch to optimize one or more indices.
func (c *Client) Optimize(indices ...string) *OptimizeService {
	builder := NewOptimizeService(c)
	builder.Indices(indices...)
	return builder
}

// Refresh asks Elasticsearch to refresh one or more indices.
func (c *Client) Refresh(indices ...string) *RefreshService {
	builder := NewRefreshService(c)
	builder.Indices(indices...)
	return builder
}

// Flush asks Elasticsearch to free memory from the index and
// flush data to disk.
func (c *Client) Flush() *FlushService {
	builder := NewFlushService(c)
	return builder
}

// Explain computes a score explanation for a query and a specific document.
func (c *Client) Explain(index, typ, id string) *ExplainService {
	builder := NewExplainService(c)
	builder = builder.Index(index).Type(typ).Id(id)
	return builder
}

// Bulk is the entry point to mass insert/update/delete documents.
func (c *Client) Bulk() *BulkService {
	builder := NewBulkService(c)
	return builder
}

// Alias enables the caller to add and/or remove aliases.
func (c *Client) Alias() *AliasService {
	builder := NewAliasService(c)
	return builder
}

// Aliases returns aliases by index name(s).
func (c *Client) Aliases() *AliasesService {
	builder := NewAliasesService(c)
	return builder
}

// GetTemplate gets a search template.
func (c *Client) GetTemplate() *GetTemplateService {
	return NewGetTemplateService(c)
}

// PutTemplate creates or updates a search template.
func (c *Client) PutTemplate() *PutTemplateService {
	return NewPutTemplateService(c)
}

// DeleteTemplate deletes a search template.
func (c *Client) DeleteTemplate() *DeleteTemplateService {
	return NewDeleteTemplateService(c)
}

// GetMapping gets a mapping.
func (c *Client) GetMapping() *GetMappingService {
	return NewGetMappingService(c)
}

// PutMapping registers a mapping.
func (c *Client) PutMapping() *PutMappingService {
	return NewPutMappingService(c)
}

// DeleteMapping deletes a mapping.
func (c *Client) DeleteMapping() *DeleteMappingService {
	return NewDeleteMappingService(c)
}

// ClusterHealth retrieves the health of the cluster.
func (c *Client) ClusterHealth() *ClusterHealthService {
	return NewClusterHealthService(c)
}

// ClusterState retrieves the state of the cluster.
func (c *Client) ClusterState() *ClusterStateService {
	return NewClusterStateService(c)
}

// NodesInfo retrieves one or more or all of the cluster nodes information.
func (c *Client) NodesInfo() *NodesInfoService {
	return NewNodesInfoService(c)
}
