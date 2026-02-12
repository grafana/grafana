//go:build ignore
// +build ignore

// Seeds the Secrets API with test keepers and secure values for local development.
// See README.md for setup instructions, configuration, and troubleshooting.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"

	"go.yaml.in/yaml/v3"
)

const (
	prefix     = "gdev"
	apiVersion = "secret.grafana.app/v1beta1"
	defaultURL = "http://localhost:3000"
)

var (
	grafanaURL   = flag.String("url", getEnv("GRAFANA_URL", defaultURL), "Grafana URL")
	namespace    = flag.String("namespace", getEnv("GRAFANA_NAMESPACE", "default"), "Namespace")
	configFile   = flag.String("config", "secrets-config.yaml", "Config file path")
	user         = flag.String("user", getEnv("GRAFANA_USER", "admin"), "Grafana username")
	password     = flag.String("password", getEnv("GRAFANA_PASSWORD", "admin"), "Grafana password")
	cleanupFlag  = flag.Bool("clean", false, "Delete all gdev-prefixed keepers and secure values")
	selfTestFlag = flag.Bool("test", false, "Run built-in self-tests (no server required)")
	generateFlag = flag.Int("generate", 0, "Generate N keepers and N secure values for load testing")
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ── Config types (YAML input) ───────────────────────────────────────────────

type Config struct {
	Keepers      map[string]KeeperConfig      `yaml:"keepers"`
	SecureValues map[string]SecureValueConfig `yaml:"secureValues"`
}

type KeeperConfig struct {
	Description string     `yaml:"description"`
	AWS         *AWSConfig `yaml:"aws,omitempty"`
}

// AWSConfig mirrors KeeperAWSConfig from the backend API.
// Source: apps/secret/pkg/apis/secret/v1beta1/keeper_spec_gen.go
type AWSConfig struct {
	Region        string `yaml:"region"`
	AssumeRoleArn string `yaml:"assumeRoleArn"`
	ExternalID    string `yaml:"externalID"`
}

type SecureValueConfig struct {
	Description string            `yaml:"description"`
	Value       string            `yaml:"value"`
	Decrypters  []string          `yaml:"decrypters,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty"`
}

// ── API resource types (JSON for POST) ──────────────────────────────────────
// These mirror the K8s resource shapes from the generated OpenAPI spec.
// Source: apps/secret/pkg/apis/secret/v1beta1/keeper_spec_gen.go

type KeeperResource struct {
	APIVersion string       `json:"apiVersion"`
	Kind       string       `json:"kind"`
	Metadata   ResourceMeta `json:"metadata"`
	Spec       KeeperSpec   `json:"spec"`
	Status     struct{}     `json:"status"`
}

type KeeperSpec struct {
	Description string         `json:"description"`
	AWS         *AWSSpecConfig `json:"aws,omitempty"`
}

type AWSSpecConfig struct {
	Region     string      `json:"region"`
	AssumeRole *AssumeRole `json:"assumeRole,omitempty"`
}

type AssumeRole struct {
	AssumeRoleArn string `json:"assumeRoleArn"`
	ExternalID    string `json:"externalID"`
}

type SecureValueResource struct {
	APIVersion string          `json:"apiVersion"`
	Kind       string          `json:"kind"`
	Metadata   ResourceMeta    `json:"metadata"`
	Spec       SecureValueSpec `json:"spec"`
	Status     struct {
		Keeper string `json:"keeper"`
	} `json:"status"`
}

type SecureValueSpec struct {
	Description string   `json:"description"`
	Value       string   `json:"value"`
	Decrypters  []string `json:"decrypters,omitempty"`
}

type ResourceMeta struct {
	Name   string            `json:"name"`
	Labels map[string]string `json:"labels,omitempty"`
}

type ListResponse struct {
	Items []struct {
		Metadata struct {
			Name string `json:"name"`
		} `json:"metadata"`
	} `json:"items"`
}

// ── HTTP client ─────────────────────────────────────────────────────────────

type Client struct {
	baseURL    string
	namespace  string
	httpClient *http.Client
	user       string
	password   string
}

func NewClient(baseURL, namespace, user, password string) *Client {
	return &Client{
		baseURL:    baseURL,
		namespace:  namespace,
		httpClient: &http.Client{},
		user:       user,
		password:   password,
	}
}

func (c *Client) apiURL(endpoint string) string {
	return fmt.Sprintf("%s/apis/%s/namespaces/%s%s", c.baseURL, apiVersion, c.namespace, endpoint)
}

func (c *Client) doRequest(method, endpoint string, body []byte) (int, []byte, error) {
	url := c.apiURL(endpoint)

	var req *http.Request
	var err error
	if body != nil {
		req, err = http.NewRequest(method, url, bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(method, url, nil)
	}
	if err != nil {
		return 0, nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(c.user, c.password)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("request to %s failed: %w", url, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, fmt.Errorf("failed to read response from %s: %w", url, err)
	}

	return resp.StatusCode, respBody, nil
}

// ── Check API availability ──────────────────────────────────────────────────

func (c *Client) checkAPI() error {
	fmt.Println("Checking Secrets API availability...")

	status, _, err := c.doRequest("GET", "/keepers", nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nCould not reach Grafana at %s\n", c.baseURL)
		fmt.Fprintln(os.Stderr, "See README.md for setup instructions.")
		return fmt.Errorf("API not available")
	}

	switch {
	case status == 401 || status == 403:
		return fmt.Errorf("authentication failed (HTTP %d) — see README.md troubleshooting", status)
	case status == 404:
		return fmt.Errorf("secrets API not found (HTTP 404) — see README.md troubleshooting")
	case status != 200:
		return fmt.Errorf("unexpected response from Secrets API (HTTP %d) — check Grafana logs", status)
	}

	fmt.Println("  Secrets API is available.")
	fmt.Println()
	return nil
}

// ── Create resources ────────────────────────────────────────────────────────

func (c *Client) createKeeper(name string, cfg KeeperConfig) {
	prefixedName := prefix + "-" + name

	spec := KeeperSpec{
		Description: cfg.Description,
	}

	if cfg.AWS != nil {
		awsSpec := &AWSSpecConfig{
			Region: cfg.AWS.Region,
		}
		if cfg.AWS.AssumeRoleArn != "" || cfg.AWS.ExternalID != "" {
			awsSpec.AssumeRole = &AssumeRole{
				AssumeRoleArn: cfg.AWS.AssumeRoleArn,
				ExternalID:    cfg.AWS.ExternalID,
			}
		}
		spec.AWS = awsSpec
	}

	resource := KeeperResource{
		APIVersion: apiVersion,
		Kind:       "Keeper",
		Metadata:   ResourceMeta{Name: prefixedName},
		Spec:       spec,
	}

	body, err := json.Marshal(resource)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  ✗ %s — could not build request body: %v\n", prefixedName, err)
		return
	}

	status, respBody, err := c.doRequest("POST", "/keepers", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  ✗ %s — request failed: %v\n", prefixedName, err)
		return
	}

	printResult("keeper", prefixedName, status, respBody)
}

func (c *Client) createSecureValue(name string, cfg SecureValueConfig) {
	prefixedName := prefix + "-" + name

	resource := SecureValueResource{
		APIVersion: apiVersion,
		Kind:       "SecureValue",
		Metadata: ResourceMeta{
			Name:   prefixedName,
			Labels: cfg.Labels,
		},
		Spec: SecureValueSpec{
			Description: cfg.Description,
			Value:       cfg.Value,
			Decrypters:  cfg.Decrypters,
		},
	}

	body, err := json.Marshal(resource)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  ✗ %s — could not build request body: %v\n", prefixedName, err)
		return
	}

	status, respBody, err := c.doRequest("POST", "/securevalues", body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  ✗ %s — request failed: %v\n", prefixedName, err)
		return
	}

	printResult("secure value", prefixedName, status, respBody)
}

func printResult(kind, name string, status int, respBody []byte) {
	switch {
	case status >= 200 && status < 300:
		fmt.Printf("  ✓ Created %s: %s\n", kind, name)
	case status == 409:
		fmt.Printf("  - %s %s already exists (skipped)\n", kind, name)
	default:
		fmt.Fprintf(os.Stderr, "  ✗ Failed to create %s %s (HTTP %d)\n", kind, name, status)
		var errResp struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Message != "" {
			fmt.Fprintf(os.Stderr, "    Reason: %s\n", errResp.Message)
		}
	}
}

// ── Delete resources ────────────────────────────────────────────────────────

func (c *Client) deleteGdevResources(endpoint, kind string) {
	fmt.Printf("Cleaning %s-%s...\n", prefix, kind)

	status, body, err := c.doRequest("GET", endpoint, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Could not list %s: %v\n", kind, err)
		return
	}
	if status != 200 {
		fmt.Fprintf(os.Stderr, "  Could not list %s (HTTP %d). Is the API server running?\n", kind, status)
		return
	}

	var list ListResponse
	if err := json.Unmarshal(body, &list); err != nil {
		fmt.Fprintf(os.Stderr, "  Could not parse %s list response: %v\n", kind, err)
		return
	}

	found := 0
	deleted := 0
	for _, item := range list.Items {
		if strings.HasPrefix(item.Metadata.Name, prefix+"-") {
			found++
			delStatus, _, delErr := c.doRequest("DELETE", fmt.Sprintf("%s/%s", endpoint, item.Metadata.Name), nil)
			if delErr != nil {
				fmt.Fprintf(os.Stderr, "  ✗ %s — request failed: %v\n", item.Metadata.Name, delErr)
			} else if delStatus == 200 || delStatus == 204 {
				fmt.Printf("  ✓ Deleted %s: %s\n", kind, item.Metadata.Name)
				deleted++
			} else {
				fmt.Fprintf(os.Stderr, "  ✗ Failed to delete %s %s (HTTP %d)\n", kind, item.Metadata.Name, delStatus)
			}
		}
	}

	if found == 0 {
		fmt.Printf("  No %s-%s found.\n", prefix, kind)
	} else if deleted < found {
		fmt.Fprintf(os.Stderr, "  Warning: %d of %d %s could not be deleted.\n", found-deleted, found, kind)
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ── Self-test (no server required) ──────────────────────────────────────────

func runSelfTests() {
	passed := 0
	failed := 0

	assert := func(name string, ok bool, msg string) {
		if ok {
			fmt.Printf("  ✓ %s\n", name)
			passed++
		} else {
			fmt.Fprintf(os.Stderr, "  ✗ %s — %s\n", name, msg)
			failed++
		}
	}

	fmt.Println("Running self-tests...\n")

	// ── Config parsing ──────────────────────────────────────────────────
	fmt.Println("Config parsing:")
	{
		configYAML := []byte(`
keepers:
  aws-prod:
    description: AWS prod
    aws:
      region: us-east-1
      assumeRoleArn: arn:aws:iam::123:role/test
      externalID: ext-id
secureValues:
  my-secret:
    description: A secret
    value: super-secret
    decrypters:
      - secrets-manager-testing
    labels:
      env: prod
`)
		var config Config
		err := yaml.Unmarshal(configYAML, &config)
		assert("parses valid YAML without error", err == nil,
			fmt.Sprintf("got error: %v", err))

		if err == nil {
			assert("finds 1 keeper", len(config.Keepers) == 1,
				fmt.Sprintf("got %d", len(config.Keepers)))

			aws := config.Keepers["aws-prod"]
			assert("AWS keeper has region", aws.AWS != nil && aws.AWS.Region == "us-east-1",
				fmt.Sprintf("got %+v", aws.AWS))
			assert("AWS keeper has assumeRoleArn", aws.AWS != nil && aws.AWS.AssumeRoleArn == "arn:aws:iam::123:role/test",
				fmt.Sprintf("got %q", aws.AWS.AssumeRoleArn))

			assert("finds 1 secure value", len(config.SecureValues) == 1,
				fmt.Sprintf("got %d", len(config.SecureValues)))

			sv := config.SecureValues["my-secret"]
			assert("secure value has label", sv.Labels["env"] == "prod",
				fmt.Sprintf("got %q", sv.Labels["env"]))
			assert("secure value has decrypter", len(sv.Decrypters) == 1 && sv.Decrypters[0] == "secrets-manager-testing",
				fmt.Sprintf("got %v", sv.Decrypters))
		}
	}
	fmt.Println()

	// ── Resource JSON structure ─────────────────────────────────────────
	fmt.Println("Keeper JSON structure:")
	{
		// AWS keeper — should include aws with assume role
		awsResource := KeeperResource{
			APIVersion: apiVersion,
			Kind:       "Keeper",
			Metadata:   ResourceMeta{Name: "gdev-aws"},
			Spec: KeeperSpec{
				Description: "AWS",
				AWS: &AWSSpecConfig{
					Region:     "us-east-1",
					AssumeRole: &AssumeRole{AssumeRoleArn: "arn:test", ExternalID: "ext"},
				},
			},
		}
		body, _ := json.Marshal(awsResource)
		var parsed map[string]interface{}
		json.Unmarshal(body, &parsed)

		_, hasStatus := parsed["status"]
		assert("keeper includes status field", hasStatus,
			"status field missing — API will reject this")

		spec := parsed["spec"].(map[string]interface{})
		aws := spec["aws"].(map[string]interface{})
		assert("AWS keeper has region", aws["region"] == "us-east-1",
			fmt.Sprintf("got %v", aws["region"]))
		role := aws["assumeRole"].(map[string]interface{})
		assert("AWS keeper has assumeRoleArn", role["assumeRoleArn"] == "arn:test",
			fmt.Sprintf("got %v", role["assumeRoleArn"]))

		// Keeper without AWS — aws should be omitted
		systemResource := KeeperResource{
			APIVersion: apiVersion,
			Kind:       "Keeper",
			Metadata:   ResourceMeta{Name: "gdev-system"},
			Spec:       KeeperSpec{Description: "System keeper"},
		}
		body, _ = json.Marshal(systemResource)
		json.Unmarshal(body, &parsed)
		spec = parsed["spec"].(map[string]interface{})
		_, hasAWS := spec["aws"]
		assert("non-AWS keeper omits aws from spec", !hasAWS,
			"aws should not be present")
	}
	fmt.Println()

	fmt.Println("SecureValue JSON structure:")
	{
		resource := SecureValueResource{
			APIVersion: apiVersion,
			Kind:       "SecureValue",
			Metadata:   ResourceMeta{Name: "gdev-secret", Labels: map[string]string{"env": "prod"}},
			Spec:       SecureValueSpec{Description: "Test", Value: "secret", Decrypters: []string{"testing"}},
		}
		body, _ := json.Marshal(resource)
		var parsed map[string]interface{}
		json.Unmarshal(body, &parsed)

		_, hasStatus := parsed["status"]
		assert("secure value includes status field", hasStatus,
			"status field missing — API will reject this")

		meta := parsed["metadata"].(map[string]interface{})
		labels := meta["labels"].(map[string]interface{})
		assert("secure value preserves labels", labels["env"] == "prod",
			fmt.Sprintf("got %v", labels["env"]))
	}
	fmt.Println()

	// ── Helpers ─────────────────────────────────────────────────────────
	fmt.Println("Helpers:")
	{
		keys := sortedKeys(map[string]int{"zebra": 1, "alpha": 2, "middle": 3})
		assert("sortedKeys returns alphabetical order",
			len(keys) == 3 && keys[0] == "alpha" && keys[1] == "middle" && keys[2] == "zebra",
			fmt.Sprintf("got %v", keys))

		assert("gdev prefix applied correctly",
			prefix+"-"+"my-keeper" == "gdev-my-keeper",
			"prefix mismatch")
	}
	fmt.Println()

	// ── HTTP interaction (mock server) ──────────────────────────────────
	fmt.Println("HTTP interactions:")
	{
		server := startTestServer(200, `{"items":[]}`)
		client := NewClient(server.URL, "default", "admin", "admin")
		err := client.checkAPI()
		server.Close()
		assert("checkAPI succeeds on 200", err == nil,
			fmt.Sprintf("got error: %v", err))

		server = startTestServer(403, ``)
		client = NewClient(server.URL, "default", "admin", "admin")
		err = client.checkAPI()
		server.Close()
		assert("checkAPI returns error on 403", err != nil && strings.Contains(err.Error(), "authentication"),
			fmt.Sprintf("got: %v", err))

		server = startTestServer(404, ``)
		client = NewClient(server.URL, "default", "admin", "admin")
		err = client.checkAPI()
		server.Close()
		assert("checkAPI returns error on 404", err != nil && strings.Contains(err.Error(), "not found"),
			fmt.Sprintf("got: %v", err))

		server = startTestServer(409, `{"message":"already exists"}`)
		client = NewClient(server.URL, "default", "admin", "admin")
		client.createKeeper("test", KeeperConfig{Description: "Test"})
		server.Close()
		assert("createKeeper handles 409 gracefully", true, "")
	}
	fmt.Println()

	// ── Summary ─────────────────────────────────────────────────────────
	total := passed + failed
	if failed > 0 {
		fmt.Fprintf(os.Stderr, "FAILED: %d of %d tests failed.\n", failed, total)
		os.Exit(1)
	}
	fmt.Printf("✓ All %d tests passed.\n", total)
}

type testServer struct {
	URL    string
	server *http.Server
}

func startTestServer(statusCode int, body string) *testServer {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(statusCode)
		w.Write([]byte(body))
	})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to start test server: %v\n", err)
		os.Exit(1)
	}
	srv := &http.Server{Handler: mux}
	go srv.Serve(listener)
	return &testServer{
		URL:    "http://" + listener.Addr().String(),
		server: srv,
	}
}

func (ts *testServer) Close() {
	ts.server.Close()
}

// ── Generate bulk test data ──────────────────────────────────────────────────

var awsRegions = []string{
	"us-east-1", "us-east-2", "us-west-1", "us-west-2",
	"eu-west-1", "eu-west-2", "eu-central-1",
	"ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
}

var (
	adjectives = []string{
		"azure", "bright", "calm", "crimson", "dark", "eager", "fast",
		"golden", "hidden", "iron", "jade", "keen", "lunar", "misty",
		"noble", "ocean", "prime", "quiet", "rapid", "silver", "tidal",
		"ultra", "vivid", "warm", "xenon", "young", "zonal",
	}
	nouns = []string{
		"anchor", "beacon", "cipher", "delta", "eagle", "falcon", "gate",
		"harbor", "index", "jetty", "kite", "lance", "maple", "nexus",
		"orbit", "panda", "quasar", "ridge", "spark", "tower", "unity",
		"vault", "whale", "xenon", "yonder", "zenith",
	}
)

// randomName generates a deterministic two-word name from an index.
// Names cycle through adjective-noun combinations (702 unique pairs).
func randomName(i int) string {
	return adjectives[i%len(adjectives)] + "-" + nouns[(i/len(adjectives))%len(nouns)]
}

func (c *Client) generateResources(count int) {
	fmt.Printf("Generating %d keepers and %d secure values...\n\n", count, count)

	fmt.Println("Creating keepers...")
	for i := 0; i < count; i++ {
		region := awsRegions[i%len(awsRegions)]
		name := "gen-aws-" + randomName(i)
		c.createKeeper(name, KeeperConfig{
			Description: fmt.Sprintf("AWS keeper in %s", region),
			AWS: &AWSConfig{
				Region:        region,
				AssumeRoleArn: fmt.Sprintf("arn:aws:iam::%012d:role/grafana-secrets-manager", 100000000000+i),
				ExternalID:    fmt.Sprintf("gdev-ext-%s", randomName(i)),
			},
		})
	}
	fmt.Println()

	fmt.Println("Creating secure values...")
	for i := 0; i < count; i++ {
		name := "gen-secret-" + randomName(i)
		c.createSecureValue(name, SecureValueConfig{
			Description: fmt.Sprintf("Secret for %s", randomName(i)),
			Value:       fmt.Sprintf("gdev-value-%s-%d", randomName(i), i),
			Decrypters:  []string{"secrets-manager-testing"},
			Labels: map[string]string{
				"generated": "true",
			},
		})
	}
	fmt.Println()

	fmt.Println("✓ Done!")
	fmt.Printf("  View keepers at: %s/admin/secrets/keepers\n", *grafanaURL)
	fmt.Printf("  View secrets at: %s/admin/secrets\n", *grafanaURL)
	fmt.Printf("\n  To remove generated data: go run secrets.go -clean\n")
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	flag.Parse()

	if *selfTestFlag {
		runSelfTests()
		return
	}

	client := NewClient(*grafanaURL, *namespace, *user, *password)

	if *cleanupFlag {
		if err := client.checkAPI(); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		client.deleteGdevResources("/securevalues", "secure values")
		client.deleteGdevResources("/keepers", "keepers")
		fmt.Println("\n✓ Cleanup complete.")
		return
	}

	if *generateFlag > 0 {
		if err := client.checkAPI(); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		client.generateResources(*generateFlag)
		return
	}

	configData, err := os.ReadFile(*configFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Could not read config file %q: %v\n", *configFile, err)
		fmt.Fprintf(os.Stderr, "\nMake sure you are running this from the devenv/secrets directory,\n")
		fmt.Fprintf(os.Stderr, "or pass -config=/path/to/secrets-config.yaml\n")
		os.Exit(1)
	}

	var config Config
	if err := yaml.Unmarshal(configData, &config); err != nil {
		fmt.Fprintf(os.Stderr, "Error: Could not parse config file %q: %v\n", *configFile, err)
		os.Exit(1)
	}

	if err := client.checkAPI(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Config:    %s\n", *configFile)
	fmt.Printf("Grafana:   %s\n", *grafanaURL)
	fmt.Printf("Namespace: %s\n", *namespace)
	fmt.Printf("Prefix:    %s-\n\n", prefix)

	if len(config.Keepers) > 0 {
		fmt.Println("Creating keepers...")
		for _, name := range sortedKeys(config.Keepers) {
			client.createKeeper(name, config.Keepers[name])
		}
		fmt.Println()
	}

	if len(config.SecureValues) > 0 {
		fmt.Println("Creating secure values...")
		for _, name := range sortedKeys(config.SecureValues) {
			client.createSecureValue(name, config.SecureValues[name])
		}
		fmt.Println()
	}

	fmt.Println("✓ Done!")
	fmt.Printf("  View keepers at: %s/admin/secrets/keepers\n", *grafanaURL)
	fmt.Printf("  View secrets at: %s/admin/secrets\n", *grafanaURL)
}
