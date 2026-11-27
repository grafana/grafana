// Command smoke checks the ha-test-nats setup. It runs in the smoke service on the
// compose network, so it reaches every instance's ports 3000, 6222 and 4222 without
// publishing them, and it kills grafana1 through the mounted Docker socket.
package main

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

const (
	project  = "ha-test-nats"
	api      = "/apis/playlist.grafana.app/v1/namespaces/default/playlists"
	certsDir = "/certs"

	// [nats] discovery_interval and discovery_ttl defaults.
	discoveryInterval = 5 * time.Second
	discoveryTTL      = 15 * time.Second
)

type smoke struct {
	dbType  string
	db      *sql.DB
	http    *http.Client
	docker  *http.Client
	started time.Time
	summary []string
	failed  int
}

func main() {
	s := &smoke{
		dbType:  envOr("GRAFANA_DB", "mysql"),
		http:    &http.Client{Timeout: 10 * time.Second},
		docker:  dockerClient(),
		started: time.Now(),
	}
	var err error
	if s.db, err = openDB(s.dbType); err != nil {
		fmt.Println("open database:", err)
		os.Exit(1)
	}

	s.section("Waiting for all Grafana instances (up to 120s)")
	if err := s.waitHealthy(120 * time.Second); err != nil {
		fmt.Printf("FAIL: %v; start the stack with 'docker compose up -d --wait' first\n", err)
		os.Exit(1)
	}

	s.checkNotifier()
	s.checkDiscovery()
	s.checkRoutes()
	s.checkRouteCredential()
	s.checkWatch()
	s.checkNoPolling()
	s.checkClusterTLS()
	s.checkClientPort()
	if os.Getenv("SKIP_KILL") == "1" {
		s.section("Skipping the kill check")
	} else {
		s.checkKill()
	}

	s.section("Summary")
	for _, line := range s.summary {
		fmt.Println(line)
	}
	os.Exit(s.failed)
}

func (s *smoke) section(title string) {
	fmt.Printf("\n== [+%ds] %s\n", int(time.Since(s.started).Seconds()), title)
}

func (s *smoke) pass(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	s.summary = append(s.summary, "PASS  "+msg)
	fmt.Println("PASS:", msg)
}

func (s *smoke) fail(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	s.summary = append(s.summary, "FAIL  "+msg)
	fmt.Println("FAIL:", msg)
	s.failed++
}

func (s *smoke) check(ok bool, format string, args ...any) {
	if ok {
		s.pass(format, args...)
	} else {
		s.fail(format, args...)
	}
}

func (s *smoke) waitHealthy(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for n := 1; n <= 3; n++ {
		for {
			resp, err := s.http.Get(fmt.Sprintf("http://grafana%d:3000/api/health", n))
			if err == nil {
				_ = resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					break
				}
			}
			if time.Now().After(deadline) {
				return fmt.Errorf("grafana%d is not healthy", n)
			}
			time.Sleep(2 * time.Second)
		}
	}
	return nil
}

// checkNotifier relies on the legacy SQL backend registering this counter only when it
// builds its NATS notifier, which replaces the polling one.
func (s *smoke) checkNotifier() {
	s.section("Notifier: every instance serves watches from NATS")
	for n := 1; n <= 3; n++ {
		metrics, err := s.metrics(n)
		if err != nil {
			s.fail("notifier: grafana%d metrics: %v", n, err)
			continue
		}
		s.check(hasFamily(metrics, "grafana_storage_server_sql_watch_missing_events_total"),
			"notifier: grafana%d registers grafana_storage_server_sql_watch_missing_events_total", n)
	}
}

func (s *smoke) checkDiscovery() {
	s.section("Discovery: every instance registers a route in nats_discovery_peers")
	var peers []peer
	for deadline := time.Now().Add(discoveryTTL + 2*discoveryInterval); time.Now().Before(deadline); time.Sleep(time.Second) {
		var err error
		if peers, err = s.peers(); err == nil && len(peers) >= 3 {
			break
		}
	}
	for _, p := range peers {
		fmt.Println("  " + p.RouteURL)
	}
	s.check(len(peers) == 3, "discovery: %d peer rows (expected 3)", len(peers))
}

func (s *smoke) checkRoutes() {
	s.section("Routes: grafana_nats_embedded_server_routes is 2 on every instance")
	for n := 1; n <= 3; n++ {
		got := -1
		for deadline := time.Now().Add(2 * discoveryInterval); time.Now().Before(deadline); time.Sleep(time.Second) {
			if got = s.routes(n); got == 2 {
				break
			}
		}
		s.check(got == 2, "routes: grafana%d has %d (expected 2)", n, got)
	}
}

func (s *smoke) checkRouteCredential() {
	s.section("Route credential: stored as a Secrets Manager encrypted value")
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM secret_encrypted_value WHERE namespace = 'default' AND name = 'nats:grafana.route-credential'").Scan(&count)
	if err != nil {
		s.fail("route credential: %v", err)
		return
	}
	s.check(count == 1, "route credential: %d row in secret_encrypted_value (expected 1)", count)
}

func (s *smoke) checkWatch() {
	s.section("Watch fan-out: create a playlist on grafana1, watch it on grafana2 and grafana3")
	name := fmt.Sprintf("smoke-%d", time.Now().Unix())
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	seen := map[int]chan time.Time{}
	for _, n := range []int{2, 3} {
		seen[n] = make(chan time.Time, 1)
		body, err := s.openWatch(ctx, n)
		if err != nil {
			s.fail("watch: grafana%d: %v", n, err)
			continue
		}
		go waitForAdded(body, name, seen[n])
	}

	created := time.Now()
	playlist := fmt.Sprintf(`{"apiVersion":"playlist.grafana.app/v1","kind":"Playlist","metadata":{"name":%q},`+
		`"spec":{"title":%q,"interval":"5m","items":[{"type":"dashboard_by_tag","value":"smoke"}]}}`, name, name)
	code, err := s.do(ctx, http.MethodPost, "http://grafana1:3000"+api, playlist, nil)
	fmt.Printf("  create on grafana1: HTTP %d %v\n", code, errOrEmpty(err))

	for _, n := range []int{2, 3} {
		select {
		case at := <-seen[n]:
			s.pass("watch: grafana%d saw ADDED (%dms)", n, at.Sub(created).Milliseconds())
		case <-time.After(15 * time.Second):
			s.fail("watch: grafana%d did not see ADDED within 15s", n)
		}
	}
}

// openWatch starts a watch on instance n from its current list resource version, so only
// the new write can match, not the initial state.
func (s *smoke) openWatch(ctx context.Context, n int) (io.ReadCloser, error) {
	base := fmt.Sprintf("http://grafana%d:3000%s", n, api)
	var list struct {
		Metadata struct {
			ResourceVersion string `json:"resourceVersion"`
		} `json:"metadata"`
	}
	if _, err := s.do(ctx, http.MethodGet, base, "", &list); err != nil {
		return nil, err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"?watch=true&resourceVersion="+url.QueryEscape(list.Metadata.ResourceVersion), nil)
	req.SetBasicAuth("admin", "admin")
	// The shared client's timeout would end the watch early; ctx bounds it instead.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("watch: HTTP %d", resp.StatusCode)
	}
	return resp.Body, nil
}

func waitForAdded(body io.ReadCloser, name string, seen chan<- time.Time) {
	defer func() { _ = body.Close() }()
	dec := json.NewDecoder(body)
	for {
		var ev struct {
			Type   string `json:"type"`
			Object struct {
				Metadata struct {
					Name string `json:"name"`
				} `json:"metadata"`
			} `json:"object"`
		}
		if err := dec.Decode(&ev); err != nil {
			return
		}
		if ev.Type == "ADDED" && ev.Object.Metadata.Name == name {
			seen <- time.Now()
			return
		}
	}
}

func (s *smoke) checkClusterTLS() {
	s.section("Cluster port 6222 requires mutual TLS")
	ca, err := os.ReadFile(certsDir + "/ca.crt")
	if err != nil {
		s.fail("tls: read CA: %v", err)
		return
	}
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(ca)
	node, err := tls.LoadX509KeyPair(certsDir+"/grafana1/node.crt", certsDir+"/grafana1/node.key")
	if err != nil {
		s.fail("tls: load node cert: %v", err)
		return
	}
	rogue, err := tls.LoadX509KeyPair(certsDir+"/rogue/node.crt", certsDir+"/rogue/node.key")
	if err != nil {
		s.fail("tls: load rogue cert: %v", err)
		return
	}
	// GetClientCertificate presents the certificate even when the server's acceptable CAs
	// don't include its issuer; with Certificates, Go would send no certificate for the rogue one.
	config := func(cert *tls.Certificate) *tls.Config {
		c := &tls.Config{RootCAs: roots, ServerName: "grafana2", MinVersion: tls.VersionTLS12}
		if cert != nil {
			c.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) { return cert, nil }
		}
		return c
	}

	if line, err := routeGreeting(config(&node)); strings.HasPrefix(line, "INFO {") {
		s.pass("tls: CA + node cert completes the handshake and gets the route INFO")
	} else {
		s.fail("tls: CA + node cert: %q %v", line, err)
	}
	line, err := routeGreeting(config(nil))
	s.check(!strings.HasPrefix(line, "INFO"), "tls: no client cert is rejected (%v)", err)
	line, err = routeGreeting(config(&rogue))
	s.check(!strings.HasPrefix(line, "INFO"), "tls: rogue CA cert is rejected (%v)", err)
	line, _ = routeGreeting(nil)
	s.check(!strings.Contains(line, "INFO"), "tls: plaintext connection gets no route INFO")
}

// routeGreeting connects to grafana2's cluster port, over TLS unless config is nil, and
// returns the first line the server sends.
func routeGreeting(config *tls.Config) (string, error) {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	var conn net.Conn
	var err error
	if config == nil {
		conn, err = dialer.Dial("tcp", "grafana2:6222")
	} else {
		conn, err = tls.DialWithDialer(dialer, "tcp", "grafana2:6222", config)
	}
	if err != nil {
		return "", err
	}
	defer func() { _ = conn.Close() }()
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	return bufio.NewReader(conn).ReadString('\n')
}

func (s *smoke) checkClientPort() {
	s.section("Client port 4222 is closed")
	for n := 1; n <= 3; n++ {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("grafana%d:4222", n), 2*time.Second)
		if err == nil {
			_ = conn.Close()
		}
		s.check(err != nil, "client port: grafana%d:4222 closed", n)
	}
}

// checkNoPolling runs right after the watch writes instead of over an idle window: a
// polling notifier reads resource_history only once the latest resource versions change,
// and a polling instance can only have delivered those writes to its watch after such a
// read, so a zero count involves no timing.
func (s *smoke) checkNoPolling() {
	s.section("No polling: grafana_storage_server_poller_query_latency_seconds has no samples")
	for n := 1; n <= 3; n++ {
		metrics, err := s.metrics(n)
		if err != nil {
			s.fail("no polling: grafana%d metrics: %v", n, err)
			continue
		}
		polls, ok := sample(metrics, "grafana_storage_server_poller_query_latency_seconds_count")
		if !ok {
			s.fail("no polling: grafana%d exposes no grafana_storage_server_poller_query_latency_seconds", n)
			continue
		}
		s.check(polls == 0, "no polling: grafana%d made %v resource_history polls", n, polls)
	}
}

// checkKill kills grafana1 and waits until a surviving peer prunes its row and both peers
// drop its route.
//
// The deadline follows pkg/infra/nats/discovery.go: a heartbeat stores updatedAt in whole
// seconds, and the row is stale once updatedAt < now - ttl, so a heartbeat just before the
// kill goes stale ttl + 1s later. Only a surviving peer's tick prunes it, and ticks run every
// interval with no jitter, so the worst case is ttl + 1s + interval. One more interval of
// margin covers a slow or failed prune tick, which is retried on the next one.
func (s *smoke) checkKill() {
	worst := discoveryTTL + time.Second + discoveryInterval
	deadline := worst + discoveryInterval
	s.section(fmt.Sprintf("Kill grafana1: its peer row is pruned and peers drop its route (worst case %s, deadline %s)", worst, deadline))

	peers, err := s.peers()
	if err != nil {
		s.fail("kill: read peers: %v", err)
		return
	}
	for _, p := range peers {
		if isGrafana1(p) {
			fmt.Printf("  last grafana1 heartbeat (updatedAt, whole seconds) %ds before the kill\n", time.Now().Unix()-p.UpdatedAt)
		}
	}
	if err := s.killContainer("grafana1"); err != nil {
		s.fail("kill: %v", err)
		return
	}
	start := time.Now()

	var rowGone, routes2, routes3 time.Duration
	for time.Since(start) <= deadline && (rowGone == 0 || routes2 == 0 || routes3 == 0) {
		if rowGone == 0 {
			if peers, err := s.peers(); err == nil && !containsGrafana1(peers) {
				rowGone = time.Since(start)
			}
		}
		if routes2 == 0 && s.routes(2) == 1 {
			routes2 = time.Since(start)
		}
		if routes3 == 0 && s.routes(3) == 1 {
			routes3 = time.Since(start)
		}
		time.Sleep(500 * time.Millisecond)
	}

	s.check(rowGone > 0, "kill: grafana1 peer row gone %s", after(rowGone, deadline))
	s.check(routes2 > 0, "kill: grafana2 has 1 route %s", after(routes2, deadline))
	s.check(routes3 > 0, "kill: grafana3 has 1 route %s", after(routes3, deadline))
}

func after(elapsed, deadline time.Duration) string {
	if elapsed == 0 {
		return "not within " + deadline.String()
	}
	return fmt.Sprintf("after %.1fs", elapsed.Seconds())
}

type peer struct {
	ServerName string `json:"serverName"`
	RouteURL   string `json:"routeURL"`
	UpdatedAt  int64  `json:"updatedAt"`
}

func (s *smoke) peers() ([]peer, error) {
	rows, err := s.db.Query("SELECT value FROM nats_discovery_peers")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var peers []peer
	for rows.Next() {
		var value []byte
		var p peer
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(value, &p); err != nil {
			return nil, err
		}
		peers = append(peers, p)
	}
	return peers, rows.Err()
}

func isGrafana1(p peer) bool {
	u, err := url.Parse(p.RouteURL)
	return err == nil && u.Hostname() == "grafana1"
}

func containsGrafana1(peers []peer) bool {
	for _, p := range peers {
		if isGrafana1(p) {
			return true
		}
	}
	return false
}

// routes returns grafana_nats_embedded_server_routes of instance n, or -1 if it can't be read.
func (s *smoke) routes(n int) int {
	metrics, err := s.metrics(n)
	if err != nil {
		return -1
	}
	if v, ok := sample(metrics, "grafana_nats_embedded_server_routes"); ok {
		return int(v)
	}
	return -1
}

func (s *smoke) metrics(n int) (string, error) {
	resp, err := s.http.Get(fmt.Sprintf("http://grafana%d:3000/metrics", n))
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	return string(body), err
}

// sample returns the value of an unlabeled sample in a Prometheus text exposition.
func sample(metrics, name string) (float64, bool) {
	for line := range strings.Lines(metrics) {
		if value, ok := strings.CutPrefix(strings.TrimSpace(line), name+" "); ok {
			v, err := strconv.ParseFloat(value, 64)
			return v, err == nil
		}
	}
	return 0, false
}

func hasFamily(metrics, name string) bool {
	return strings.Contains(metrics, "# TYPE "+name+" ")
}

// do sends an authenticated request and decodes a JSON response into out when it is set.
func (s *smoke) do(ctx context.Context, method, target, body string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, method, target, strings.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.SetBasicAuth("admin", "admin")
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return resp.StatusCode, fmt.Errorf("%s", msg)
	}
	if out != nil {
		return resp.StatusCode, json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode, nil
}

func dockerClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", "/var/run/docker.sock")
			},
		},
	}
}

func containerName(service string) string {
	return project + "-" + service + "-1"
}

func (s *smoke) killContainer(service string) error {
	resp, err := s.docker.Post("http://docker/containers/"+containerName(service)+"/kill", "", nil)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusNoContent {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker kill %s: HTTP %d %s", service, resp.StatusCode, msg)
	}
	return nil
}

func openDB(dbType string) (*sql.DB, error) {
	switch dbType {
	case "postgres":
		return sql.Open("postgres", "host=db port=5432 user=grafana password=password dbname=grafana sslmode=disable")
	case "mysql":
		return sql.Open("mysql", "grafana:password@tcp(db:3306)/grafana")
	default:
		return nil, fmt.Errorf("GRAFANA_DB must be mysql or postgres, not %q", dbType)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func errOrEmpty(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
