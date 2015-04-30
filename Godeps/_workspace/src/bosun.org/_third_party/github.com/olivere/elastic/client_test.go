// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"
)

func findConn(s string, slice ...*conn) (int, bool) {
	for i, t := range slice {
		if s == t.URL() {
			return i, true
		}
	}
	return -1, false
}

// -- NewClient --

func TestClientWithoutURL(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	// Two things should happen here:
	// 1. The client starts sniffing the cluster on DefaultURL
	// 2. The sniffing process should find (at least) one node in the cluster, i.e. the DefaultURL
	if len(client.conns) == 0 {
		t.Fatalf("expected at least 1 node in the cluster, got: %d (%v)", len(client.conns), client.conns)
	}
	if !isTravis() {
		if _, found := findConn(DefaultURL, client.conns...); !found {
			t.Errorf("expected to find node with default URL of %s in %v", DefaultURL, client.conns)
		}
	}
}

func TestClientWithSingleURL(t *testing.T) {
	client, err := NewClient(SetURL("http://localhost:9200"))
	if err != nil {
		t.Fatal(err)
	}
	// Two things should happen here:
	// 1. The client starts sniffing the cluster on DefaultURL
	// 2. The sniffing process should find (at least) one node in the cluster, i.e. the DefaultURL
	if len(client.conns) == 0 {
		t.Fatalf("expected at least 1 node in the cluster, got: %d (%v)", len(client.conns), client.conns)
	}
	if !isTravis() {
		if _, found := findConn(DefaultURL, client.conns...); !found {
			t.Errorf("expected to find node with default URL of %s in %v", DefaultURL, client.conns)
		}
	}
}

func TestClientWithMultipleURLs(t *testing.T) {
	client, err := NewClient(SetURL("http://localhost:9200", "http://localhost:9201"))
	if err != nil {
		t.Fatal(err)
	}
	// The client should sniff both URLs, but only localhost:9200 should return nodes.
	if len(client.conns) != 1 {
		t.Fatalf("expected exactly 1 node in the local cluster, got: %d (%v)", len(client.conns), client.conns)
	}
	if !isTravis() {
		if client.conns[0].URL() != DefaultURL {
			t.Errorf("expected to find node with default URL of %s in %v", DefaultURL, client.conns)
		}
	}
}

func TestClientSniffSuccess(t *testing.T) {
	client, err := NewClient(SetURL("http://localhost:19200", "http://localhost:9200"))
	if err != nil {
		t.Fatal(err)
	}
	// The client should sniff both URLs, but only localhost:9200 should return nodes.
	if len(client.conns) != 1 {
		t.Fatalf("expected exactly 1 node in the local cluster, got: %d (%v)", len(client.conns), client.conns)
	}
}

func TestClientSniffFailure(t *testing.T) {
	_, err := NewClient(SetURL("http://localhost:19200", "http://localhost:19201"))
	if err == nil {
		t.Fatalf("expected cluster to fail with no nodes found")
	}
}

func TestClientSniffDisabled(t *testing.T) {
	client, err := NewClient(SetSniff(false), SetURL("http://localhost:9200", "http://localhost:9201"))
	if err != nil {
		t.Fatal(err)
	}
	// The client should not sniff, so it should have two connections.
	if len(client.conns) != 2 {
		t.Fatalf("expected 2 nodes, got: %d (%v)", len(client.conns), client.conns)
	}
	// Make two requests, so that both connections are being used
	for i := 0; i < len(client.conns); i++ {
		_, err = client.Flush().Do()
		if err != nil {
			t.Fatal(err)
		}
	}
	// The first connection (localhost:9200) should now be okay.
	if i, found := findConn("http://localhost:9200", client.conns...); !found {
		t.Fatalf("expected connection to %q to be found", "http://localhost:9200")
	} else {
		if conn := client.conns[i]; conn.IsDead() {
			t.Fatal("expected connection to be alive, but it is dead")
		}
	}
	// The second connection (localhost:9201) should now be marked as dead.
	if i, found := findConn("http://localhost:9201", client.conns...); !found {
		t.Fatalf("expected connection to %q to be found", "http://localhost:9201")
	} else {
		if conn := client.conns[i]; !conn.IsDead() {
			t.Fatal("expected connection to be dead, but it is alive")
		}
	}
}

// -- Start and stop --

func TestClientStartAndStop(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}

	running := client.IsRunning()
	if !running {
		t.Fatalf("expected background processes to run; got: %v", running)
	}

	// Stop
	client.Stop()
	running = client.IsRunning()
	if running {
		t.Fatalf("expected background processes to be stopped; got: %v", running)
	}

	// Stop again => no-op
	client.Stop()
	running = client.IsRunning()
	if running {
		t.Fatalf("expected background processes to be stopped; got: %v", running)
	}

	// Start
	client.Start()
	running = client.IsRunning()
	if !running {
		t.Fatalf("expected background processes to run; got: %v", running)
	}

	// Start again => no-op
	client.Start()
	running = client.IsRunning()
	if !running {
		t.Fatalf("expected background processes to run; got: %v", running)
	}
}

// -- Sniffing --

func TestClientSniffNode(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}

	ch := make(chan []*conn)
	go func() { ch <- client.sniffNode(DefaultURL) }()

	select {
	case nodes := <-ch:
		if len(nodes) != 1 {
			t.Fatalf("expected %d nodes; got: %d", 1, len(nodes))
		}
		pattern := `http:\/\/[\d\.]+:9200`
		matched, err := regexp.MatchString(pattern, nodes[0].URL())
		if err != nil {
			t.Fatal(err)
		}
		if !matched {
			t.Fatalf("expected node URL pattern %q; got: %q", pattern, nodes[0].URL())
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected no timeout in sniff node")
		break
	}
}

func TestClientSniffOnDefaultURL(t *testing.T) {
	client, _ := NewClient()
	if client == nil {
		t.Fatal("no client returned")
	}

	ch := make(chan error, 1)
	go func() {
		ch <- client.sniff()
	}()

	select {
	case err := <-ch:
		if err != nil {
			t.Fatalf("expected sniff to succeed; got: %v", err)
		}
		if len(client.conns) != 1 {
			t.Fatalf("expected %d nodes; got: %d", 1, len(client.conns))
		}
		pattern := `http:\/\/[\d\.]+:9200`
		matched, err := regexp.MatchString(pattern, client.conns[0].URL())
		if err != nil {
			t.Fatal(err)
		}
		if !matched {
			t.Fatalf("expected node URL pattern %q; got: %q", pattern, client.conns[0].URL())
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected no timeout in sniff")
		break
	}
}

// -- Selector --

func TestClientSelectConnHealthy(t *testing.T) {
	client, err := NewClient(
		SetSniff(false),
		SetHealthcheck(false),
		SetURL("http://127.0.0.1:9200", "http://127.0.0.1:9201"))
	if err != nil {
		t.Fatal(err)
	}

	// Both are healthy, so we should get both URLs in round-robin
	client.conns[0].MarkAsHealthy()
	client.conns[1].MarkAsHealthy()

	// #1: Return 1st
	c, err := client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[0].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[0].URL())
	}
	// #2: Return 2nd
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[1].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[1].URL())
	}
	// #3: Return 1st
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[0].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[0].URL())
	}
}

func TestClientSelectConnHealthyAndDead(t *testing.T) {
	client, err := NewClient(
		SetSniff(false),
		SetHealthcheck(false),
		SetURL("http://127.0.0.1:9200", "http://127.0.0.1:9201"))
	if err != nil {
		t.Fatal(err)
	}

	// 1st is healthy, second is dead
	client.conns[0].MarkAsHealthy()
	client.conns[1].MarkAsDead()

	// #1: Return 1st
	c, err := client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[0].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[0].URL())
	}
	// #2: Return 1st again
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[0].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[0].URL())
	}
	// #3: Return 1st again and again
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[0].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[0].URL())
	}
}

func TestClientSelectConnDeadAndHealthy(t *testing.T) {
	client, err := NewClient(
		SetSniff(false),
		SetHealthcheck(false),
		SetURL("http://127.0.0.1:9200", "http://127.0.0.1:9201"))
	if err != nil {
		t.Fatal(err)
	}

	// 1st is dead, 2nd is healthy
	client.conns[0].MarkAsDead()
	client.conns[1].MarkAsHealthy()

	// #1: Return 2nd
	c, err := client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[1].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[1].URL())
	}
	// #2: Return 2nd again
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[1].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[1].URL())
	}
	// #3: Return 2nd again and again
	c, err = client.next()
	if err != nil {
		t.Fatal(err)
	}
	if c.URL() != client.conns[1].URL() {
		t.Fatalf("expected %s; got: %s", c.URL(), client.conns[1].URL())
	}
}

func TestClientSelectConnAllDead(t *testing.T) {
	client, err := NewClient(
		SetSniff(false),
		SetHealthcheck(false),
		SetURL("http://127.0.0.1:9200", "http://127.0.0.1:9201"))
	if err != nil {
		t.Fatal(err)
	}

	// Both are dead
	client.conns[0].MarkAsDead()
	client.conns[1].MarkAsDead()

	// #1: Return ErrNoClient
	c, err := client.next()
	if err != ErrNoClient {
		t.Fatal(err)
	}
	if c != nil {
		t.Fatalf("expected no connection; got: %v", c)
	}
	// #2: Return ErrNoClient again
	c, err = client.next()
	if err != ErrNoClient {
		t.Fatal(err)
	}
	if c != nil {
		t.Fatalf("expected no connection; got: %v", c)
	}
	// #3: Return ErrNoClient again and again
	c, err = client.next()
	if err != ErrNoClient {
		t.Fatal(err)
	}
	if c != nil {
		t.Fatalf("expected no connection; got: %v", c)
	}
}

// -- ElasticsearchVersion --

func TestElasticsearchVersion(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	version, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if version == "" {
		t.Errorf("expected a version number, got: %q", version)
	}
}

// -- IndexNames --

func TestIndexNames(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)
	names, err := client.IndexNames()
	if err != nil {
		t.Fatal(err)
	}
	if len(names) == 0 {
		t.Fatalf("expected some index names, got: %d", len(names))
	}
	var found bool
	for _, name := range names {
		if name == testIndexName {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected to find index %q; got: %v", testIndexName, found)
	}
}

// -- PerformRequest --

func TestPerformRequest(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	res, err := client.PerformRequest("GET", "/", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected response to be != nil")
	}

	ret := new(PingResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		t.Fatalf("expected no error on decode; got: %v", err)
	}
	if ret.Status != 200 {
		t.Errorf("expected HTTP status 200; got: %d", ret.Status)
	}
}

func TestPerformRequestWithLogger(t *testing.T) {
	var w bytes.Buffer
	out := log.New(&w, "LOGGER ", log.LstdFlags)

	client, err := NewClient(SetInfoLog(out))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest("GET", "/", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected response to be != nil")
	}

	ret := new(PingResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		t.Fatalf("expected no error on decode; got: %v", err)
	}
	if ret.Status != 200 {
		t.Errorf("expected HTTP status 200; got: %d", ret.Status)
	}

	got := w.String()
	pattern := `^LOGGER \d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2} GET http://.*/ \[status:200, request:\d+\.\d{3}s\]\n`
	matched, err := regexp.MatchString(pattern, got)
	if err != nil {
		t.Fatalf("expected log line to match %q; got: %v", pattern, err)
	}
	if !matched {
		t.Errorf("expected log line to match %q; got: %v", pattern, got)
	}
}

func TestPerformRequestWithLoggerAndTracer(t *testing.T) {
	var lw bytes.Buffer
	lout := log.New(&lw, "LOGGER ", log.LstdFlags)

	var tw bytes.Buffer
	tout := log.New(&tw, "TRACER ", log.LstdFlags)

	client, err := NewClient(SetInfoLog(lout), SetTraceLog(tout))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest("GET", "/", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected response to be != nil")
	}

	ret := new(PingResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		t.Fatalf("expected no error on decode; got: %v", err)
	}
	if ret.Status != 200 {
		t.Errorf("expected HTTP status 200; got: %d", ret.Status)
	}

	lgot := lw.String()
	if lgot == "" {
		t.Errorf("expected logger output; got: %q", lgot)
	}

	tgot := tw.String()
	if tgot == "" {
		t.Errorf("expected tracer output; got: %q", tgot)
	}
}

// failingTransport will run a fail callback if it sees a given URL path prefix.
type failingTransport struct {
	path string                                      // path prefix to look for
	fail func(*http.Request) (*http.Response, error) // call when path prefix is found
	next http.RoundTripper                           // next round-tripper (use http.DefaultTransport if nil)
}

// RoundTrip implements a failing transport.
func (tr *failingTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	if strings.HasPrefix(r.URL.Path, tr.path) && tr.fail != nil {
		return tr.fail(r)
	}
	if tr.next != nil {
		return tr.next.RoundTrip(r)
	}
	return http.DefaultTransport.RoundTrip(r)
}

func TestPerformRequestWithMaxRetries(t *testing.T) {
	var numFailedReqs int
	fail := func(r *http.Request) (*http.Response, error) {
		numFailedReqs += 1
		return &http.Response{Request: r, StatusCode: 400}, nil
	}

	// Run against a failing endpoint and see if PerformRequest
	// retries correctly.
	tr := &failingTransport{path: "/fail", fail: fail}
	httpClient := &http.Client{Transport: tr}

	client, err := NewClient(SetHttpClient(httpClient), SetMaxRetries(5))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest("GET", "/fail", nil, nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if res != nil {
		t.Fatal("expected no response")
	}
	// Connection should be marked as dead after it failed
	if numFailedReqs != 5 {
		t.Errorf("expected %d failed requests; got: %d", 5, numFailedReqs)
	}
}
