//go:build ignore
// +build ignore

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/scope/pkg/apis/scope/v0alpha1"
)

const (
	prefix      = "gdev"
	apiVersion  = "scope.grafana.app/v0alpha1"
	defaultURL  = "http://localhost:3000"
	defaultUser = "admin"
)

var (
	grafanaURL  = flag.String("url", getEnv("GRAFANA_URL", defaultURL), "Grafana URL")
	namespace   = flag.String("namespace", getEnv("GRAFANA_NAMESPACE", "default"), "Namespace")
	configFile  = flag.String("config", "scopes-config.yaml", "Config file path")
	user        = flag.String("user", getEnv("GRAFANA_USER", defaultUser), "Grafana username")
	password    = flag.String("password", getEnv("GRAFANA_PASSWORD", "admin"), "Grafana password")
	cleanupFlag = flag.Bool("clean", false, "Delete all gdev-prefixed resources")
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

type Config struct {
	Scopes      map[string]ScopeConfig      `yaml:"scopes"`
	Tree        map[string]TreeNode         `yaml:"tree"`
	Navigations map[string]NavigationConfig `yaml:"navigations"`
}

// ScopeConfig is used for YAML parsing - converts to v0alpha1.ScopeSpec
type ScopeConfig struct {
	Title   string              `yaml:"title"`
	Filters []ScopeFilterConfig `yaml:"filters"`
}

// ScopeFilterConfig is used for YAML parsing - converts to v0alpha1.ScopeFilter
type ScopeFilterConfig struct {
	Key      string   `yaml:"key"`
	Value    string   `yaml:"value"`
	Values   []string `yaml:"values,omitempty"`
	Operator string   `yaml:"operator"`
}

// TreeNode is used for YAML parsing - converts to v0alpha1.ScopeNodeSpec
type TreeNode struct {
	Title    string              `yaml:"title"`
	NodeType string              `yaml:"nodeType"`
	LinkID   string              `yaml:"linkId,omitempty"`
	LinkType string              `yaml:"linkType,omitempty"`
	Children map[string]TreeNode `yaml:"children,omitempty"`
}

type NavigationConfig struct {
	URL   string `yaml:"url"` // URL path (e.g., /d/abc123 or /explore)
	Scope string `yaml:"scope"`
}

// Helper function to convert ScopeFilterConfig to v0alpha1.ScopeFilter
func convertFilter(cfg ScopeFilterConfig) v0alpha1.ScopeFilter {
	filter := v0alpha1.ScopeFilter{
		Key:      cfg.Key,
		Value:    cfg.Value,
		Values:   cfg.Values,
		Operator: v0alpha1.FilterOperator(cfg.Operator),
	}
	return filter
}

// Helper function to convert ScopeConfig to v0alpha1.ScopeSpec
func convertScopeSpec(cfg ScopeConfig) v0alpha1.ScopeSpec {
	filters := make([]v0alpha1.ScopeFilter, len(cfg.Filters))
	for i, f := range cfg.Filters {
		filters[i] = convertFilter(f)
	}
	return v0alpha1.ScopeSpec{
		Title:   cfg.Title,
		Filters: filters,
	}
}

type Client struct {
	baseURL    string
	namespace  string
	httpClient *http.Client
	auth       string
}

// checkFeatureFlag checks if a feature flag is enabled via the features API
func (c *Client) checkFeatureFlag(flagName string) (bool, error) {
	url := fmt.Sprintf("%s/apis/features.grafana.app/v0alpha1/namespaces/%s/ofrep/v1/evaluate/flags/%s", c.baseURL, c.namespace, flagName)
	
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(strings.Split(c.auth, ":")[0], strings.Split(c.auth, ":")[1])
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == 404 {
		// Feature flag API might not be available, assume enabled for backward compatibility
		return true, nil
	}
	
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// If we can't check, assume enabled for backward compatibility
		return true, nil
	}
	
	var result struct {
		Value  bool   `json:"value"`
		Key    string `json:"key"`
		Reason string `json:"reason"`
		Variant string `json:"variant"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// If we can't decode, assume enabled for backward compatibility
		return true, nil
	}
	
	return result.Value, nil
}

// checkScopeAPIEnabled checks if the scope API is available by checking the feature flag
func (c *Client) checkScopeAPIEnabled() (bool, error) {
	return c.checkFeatureFlag("scopeApi")
}

func NewClient(baseURL, namespace, user, password string) *Client {
	return &Client{
		baseURL:    baseURL,
		namespace:  namespace,
		httpClient: &http.Client{},
		auth:       basicAuth(user, password),
	}
}

func basicAuth(username, password string) string {
	return fmt.Sprintf("%s:%s", username, password)
}

func (c *Client) makeRequest(method, endpoint string, body []byte) error {
	url := fmt.Sprintf("%s/apis/%s/namespaces/%s%s", c.baseURL, apiVersion, c.namespace, endpoint)

	var req *http.Request
	var err error

	if body != nil {
		req, err = http.NewRequest(method, url, bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(strings.Split(c.auth, ":")[0], strings.Split(c.auth, ":")[1])

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		// For DELETE requests, 404 is acceptable (resource already deleted)
		if resp.StatusCode == 404 {
			return nil
		}
		return fmt.Errorf("API request failed: HTTP %d - %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func (c *Client) createScope(name string, cfg ScopeConfig) error {
	prefixedName := prefix + "-" + name

	spec := convertScopeSpec(cfg)

	resource := v0alpha1.Scope{
		TypeMeta: metav1.TypeMeta{
			APIVersion: apiVersion,
			Kind:       "Scope",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: prefixedName,
		},
		Spec: spec,
	}

	body, err := json.Marshal(resource)
	if err != nil {
		return fmt.Errorf("failed to marshal scope: %w", err)
	}

	fmt.Printf("✓ Creating scope: %s\n", prefixedName)
	return c.makeRequest("POST", "/scopes", body)
}

func (c *Client) createScopeNode(name string, node TreeNode, parentName string) error {
	prefixedName := prefix + "-" + name
	prefixedParent := ""
	prefixedLinkID := ""

	if parentName != "" {
		prefixedParent = prefix + "-" + parentName
	}

	if node.LinkID != "" {
		prefixedLinkID = prefix + "-" + node.LinkID
	}

	nodeType := v0alpha1.NodeType(node.NodeType)
	if nodeType == "" {
		nodeType = v0alpha1.NodeTypeContainer
	}

	linkType := v0alpha1.LinkType(node.LinkType)
	if linkType == "" {
		linkType = v0alpha1.LinkTypeScope
	}

	spec := v0alpha1.ScopeNodeSpec{
		Title:              node.Title,
		NodeType:           nodeType,
		DisableMultiSelect: false,
	}

	if prefixedParent != "" {
		spec.ParentName = prefixedParent
	}

	if prefixedLinkID != "" {
		spec.LinkID = prefixedLinkID
		spec.LinkType = linkType
	}

	resource := v0alpha1.ScopeNode{
		TypeMeta: metav1.TypeMeta{
			APIVersion: apiVersion,
			Kind:       "ScopeNode",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: prefixedName,
		},
		Spec: spec,
	}

	body, err := json.Marshal(resource)
	if err != nil {
		return fmt.Errorf("failed to marshal scope node: %w", err)
	}

	fmt.Printf("✓ Creating scope node: %s\n", prefixedName)
	return c.makeRequest("POST", "/scopenodes", body)
}

func (c *Client) createScopeNavigation(name string, nav NavigationConfig) error {
	prefixedName := prefix + "-" + name
	prefixedScope := prefix + "-" + nav.Scope

	if nav.URL == "" {
		return fmt.Errorf("navigation %s must have 'url' specified", name)
	}

	spec := v0alpha1.ScopeNavigationSpec{
		URL:   nav.URL,
		Scope: prefixedScope,
	}

	resource := v0alpha1.ScopeNavigation{
		TypeMeta: metav1.TypeMeta{
			APIVersion: apiVersion,
			Kind:       "ScopeNavigation",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: prefixedName,
		},
		Spec: spec,
	}

	body, err := json.Marshal(resource)
	if err != nil {
		return fmt.Errorf("failed to marshal scope navigation: %w", err)
	}

	fmt.Printf("✓ Creating scope navigation: %s\n", prefixedName)
	return c.makeRequest("POST", "/scopenavigations", body)
}

func (c *Client) createTreeNodes(children map[string]TreeNode, parentName string) error {
	for name, node := range children {
		// Build full node name by appending to parent name
		// This makes it easy to see the tree path from the node name
		fullNodeName := name
		if parentName != "" {
			fullNodeName = parentName + "-" + name
		}

		// parentName here is the full parent name (already includes full path)
		err := c.createScopeNode(fullNodeName, node, parentName)
		if err != nil {
			return err
		}

		if len(node.Children) > 0 {
			// Pass fullNodeName as parent for children (will be prefixed with "gdev-" in createScopeNode)
			if err := c.createTreeNodes(node.Children, fullNodeName); err != nil {
				return err
			}
		}
	}

	return nil
}

func (c *Client) deleteResources() error {
	fmt.Println("Deleting all gdev-prefixed resources...")

	// Delete scopes
	if err := c.deleteResourceType("/scopes", "scope"); err != nil {
		return err
	}

	// Delete scope nodes
	if err := c.deleteResourceType("/scopenodes", "scope node"); err != nil {
		return err
	}

	// Delete scope navigations
	if err := c.deleteResourceType("/scopenavigations", "scope navigation"); err != nil {
		return err
	}

	fmt.Println("✓ Cleanup complete")
	return nil
}

func (c *Client) deleteResourceType(endpoint, resourceType string) error {
	url := fmt.Sprintf("%s/apis/%s/namespaces/%s%s", c.baseURL, apiVersion, c.namespace, endpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(strings.Split(c.auth, ":")[0], strings.Split(c.auth, ":")[1])

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("  Warning: Failed to list %s: HTTP %d - %s\n", resourceType, resp.StatusCode, string(bodyBytes))
		return nil
	}

	var listResponse struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"items"`
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(bodyBytes, &listResponse); err != nil {
		fmt.Printf("  Warning: Failed to decode %s list response: %v\n", resourceType, err)
		fmt.Printf("  Response body: %s\n", string(bodyBytes))
		return nil
	}

	if len(listResponse.Items) == 0 {
		fmt.Printf("  No %s found\n", resourceType)
		return nil
	}

	deletedCount := 0
	for _, item := range listResponse.Items {
		if strings.HasPrefix(item.Metadata.Name, prefix+"-") {
			fmt.Printf("  Deleting %s: %s\n", resourceType, item.Metadata.Name)
			deleteURL := fmt.Sprintf("%s/%s", endpoint, item.Metadata.Name)
			if err := c.makeRequest("DELETE", deleteURL, nil); err != nil {
				fmt.Printf("    Warning: Failed to delete %s: %v\n", item.Metadata.Name, err)
			} else {
				deletedCount++
			}
		}
	}

	if deletedCount == 0 {
		fmt.Printf("  No %s with prefix '%s-' found\n", resourceType, prefix)
	}

	return nil
}

func main() {
	flag.Parse()
	
	client := NewClient(*grafanaURL, *namespace, *user, *password)
	
	// Check if scope API is enabled
	enabled, err := client.checkScopeAPIEnabled()
	if err != nil {
		fmt.Printf("Warning: Could not check if scope API is enabled: %v\n", err)
		fmt.Printf("Skipping scope provisioning...\n\n")
		return
	}
	if !enabled {
		fmt.Printf("Scope API feature flag is not enabled. Skipping scope provisioning.\n")
		fmt.Printf("To enable scopes, set the 'scopeApi' feature flag.\n\n")
		return
	}
	
	if *cleanupFlag {
		if err := client.deleteResources(); err != nil {
			fmt.Fprintf(os.Stderr, "Error during cleanup: %v\n", err)
			os.Exit(1)
		}
		return
	}

	configData, err := os.ReadFile(*configFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading config file: %v\n", err)
		os.Exit(1)
	}

	var config Config
	if err := yaml.Unmarshal(configData, &config); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing config file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Loading configuration from: %s\n", *configFile)
	fmt.Printf("Grafana URL: %s\n", *grafanaURL)
	fmt.Printf("Namespace: %s\n", *namespace)
	fmt.Printf("Prefix: %s\n\n", prefix)

	// Create scopes
	fmt.Println("Creating scopes...")
	for name, scope := range config.Scopes {
		if err := client.createScope(name, scope); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating scope %s: %v\n", name, err)
			os.Exit(1)
		}
	}
	fmt.Println()

	// Create scope nodes (tree structure)
	if len(config.Tree) > 0 {
		fmt.Println("Creating scope nodes...")
		if err := client.createTreeNodes(config.Tree, ""); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating scope nodes: %v\n", err)
			os.Exit(1)
		}
		fmt.Println()
	}

	// Create scope navigations
	if len(config.Navigations) > 0 {
		fmt.Println("Creating scope navigations...")
		for name, nav := range config.Navigations {
			if err := client.createScopeNavigation(name, nav); err != nil {
				fmt.Fprintf(os.Stderr, "Error creating scope navigation %s: %v\n", name, err)
				os.Exit(1)
			}
		}
		fmt.Println()
	}

	fmt.Println("✓ All resources created successfully!")
}
