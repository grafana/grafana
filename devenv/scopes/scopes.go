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
	Scopes         map[string]ScopeConfig      `yaml:"scopes"`
	Tree           map[string]TreeNode         `yaml:"tree"`
	Navigations    map[string]NavigationConfig `yaml:"navigations"`
	NavigationTree []NavigationTreeNode        `yaml:"navigationTree"`
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
	Title              string              `yaml:"title"`
	SubTitle           string              `yaml:"subTitle,omitempty"`
	NodeType           string              `yaml:"nodeType"`
	LinkID             string              `yaml:"linkId,omitempty"`
	LinkType           string              `yaml:"linkType,omitempty"`
	DisableMultiSelect bool                `yaml:"disableMultiSelect,omitempty"`
	Children           map[string]TreeNode `yaml:"children,omitempty"`
}

type NavigationConfig struct {
	URL      string   `yaml:"url"`      // URL path (e.g., /d/abc123 or /explore)
	Scope    string   `yaml:"scope"`    // Required scope
	SubScope string   `yaml:"subScope"` // Optional subScope for hierarchical navigation
	Title    string   `yaml:"title"`    // Display title
	Groups   []string `yaml:"groups"`   // Optional groups for categorization
}

// NavigationTreeNode represents a node in the navigation tree structure
type NavigationTreeNode struct {
	Name     string               `yaml:"name"`
	Title    string               `yaml:"title"`
	URL      string               `yaml:"url"`
	Scope    string               `yaml:"scope"`
	SubScope string               `yaml:"subScope,omitempty"`
	Groups   []string             `yaml:"groups,omitempty"`
	Children []NavigationTreeNode `yaml:"children,omitempty"`
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

func (c *Client) getScopeNavigation(name string) (*v0alpha1.ScopeNavigation, error) {
	url := fmt.Sprintf("%s/apis/%s/namespaces/%s/scopenavigations/%s", c.baseURL, apiVersion, c.namespace, name)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(strings.Split(c.auth, ":")[0], strings.Split(c.auth, ":")[1])

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed: HTTP %d - %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var navigation v0alpha1.ScopeNavigation
	if err := json.Unmarshal(bodyBytes, &navigation); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &navigation, nil
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
		SubTitle:           node.SubTitle,
		NodeType:           nodeType,
		DisableMultiSelect: node.DisableMultiSelect,
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

	if nav.URL == "" {
		return fmt.Errorf("navigation %s must have 'url' specified", name)
	}

	if nav.Scope == "" {
		return fmt.Errorf("navigation %s must have 'scope' specified", name)
	}

	prefixedScope := prefix + "-" + nav.Scope

	spec := v0alpha1.ScopeNavigationSpec{
		URL:   nav.URL,
		Scope: prefixedScope,
	}

	if nav.SubScope != "" {
		prefixedSubScope := prefix + "-" + nav.SubScope
		spec.SubScope = prefixedSubScope
	}

	status := v0alpha1.ScopeNavigationStatus{
		Title: nav.Title,
	}
	if len(nav.Groups) > 0 {
		status.Groups = nav.Groups
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
	if err := c.makeRequest("POST", "/scopenavigations", body); err != nil {
		return err
	}

	// Update status in a second request (status is a subresource)
	if nav.Title != "" || len(nav.Groups) > 0 {
		// Get the created resource to retrieve its resourceVersion and existing spec
		createdNav, err := c.getScopeNavigation(prefixedName)
		if err != nil {
			return fmt.Errorf("failed to get created navigation: %w", err)
		}

		statusResource := v0alpha1.ScopeNavigation{
			TypeMeta: metav1.TypeMeta{
				APIVersion: apiVersion,
				Kind:       "ScopeNavigation",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:            prefixedName,
				ResourceVersion: createdNav.ObjectMeta.ResourceVersion,
			},
			Spec:   createdNav.Spec, // Include existing spec to prevent it from being cleared
			Status: status,
		}

		statusBody, err := json.Marshal(statusResource)
		if err != nil {
			return fmt.Errorf("failed to marshal scope navigation status: %w", err)
		}

		fmt.Printf("  Updating status for: %s\n", prefixedName)
		return c.makeRequest("PUT", fmt.Sprintf("/scopenavigations/%s/status", prefixedName), statusBody)
	}

	return nil
}

// NavigationWithName pairs a navigation config with its name and title
type NavigationWithName struct {
	Name  string
	Title string
	Nav   NavigationConfig
}

// Convert navigation tree to flat navigations (similar to mock's treeToNavigations)
func treeToNavigations(node NavigationTreeNode, parentPath []string, dashboardCounter *int) []NavigationWithName {
	navigations := []NavigationWithName{}
	currentPath := append(parentPath, node.Name)

	// Generate URL if not provided (cycle through dash-1, dash-2, etc.)
	url := node.URL
	if url == "" {
		*dashboardCounter++
		url = fmt.Sprintf("/d/dash-%d", *dashboardCounter)
	}

	// Create navigation for this node
	nav := NavigationConfig{
		URL:   url,
		Scope: node.Scope,
		Title: node.Title,
	}
	if node.SubScope != "" {
		nav.SubScope = node.SubScope
	}
	if len(node.Groups) > 0 {
		nav.Groups = node.Groups
	}
	navigations = append(navigations, NavigationWithName{
		Name:  node.Name,
		Title: node.Title,
		Nav:   nav,
	})

	// Process children - they inherit the parent's subScope as their scope, or use parent's scope if no subScope
	if len(node.Children) > 0 {
		for _, child := range node.Children {
			// Children inherit the parent's subScope as their scope, or use parent's scope if no subScope
			childScope := node.SubScope
			if childScope == "" {
				childScope = node.Scope
			}
			// Override with child's scope if explicitly set
			if child.Scope != "" {
				childScope = child.Scope
			} else {
				child.Scope = childScope
			}
			navigations = append(navigations, treeToNavigations(child, currentPath, dashboardCounter)...)
		}
	}

	return navigations
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

func (c *Client) deleteResources() {
	fmt.Println("Deleting all gdev-prefixed resources...")

	// Delete scopes (silently handle errors if endpoints aren't available)
	c.deleteResourceType("/scopes", "scope")

	// Delete scope nodes
	c.deleteResourceType("/scopenodes", "scope node")

	// Delete scope navigations
	c.deleteResourceType("/scopenavigations", "scope navigation")

	fmt.Println("✓ Cleanup complete")
}

func (c *Client) deleteResourceType(endpoint, resourceType string) {
	url := fmt.Sprintf("%s/apis/%s/namespaces/%s%s", c.baseURL, apiVersion, c.namespace, endpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		// Silently skip if we can't create request
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(strings.Split(c.auth, ":")[0], strings.Split(c.auth, ":")[1])

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Silently skip if endpoint isn't available
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Silently skip if endpoint returns error (might not be available)
		return
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
		// Silently skip if we can't decode response
		return
	}

	if len(listResponse.Items) == 0 {
		return
	}

	deletedCount := 0
	for _, item := range listResponse.Items {
		if strings.HasPrefix(item.Metadata.Name, prefix+"-") {
			fmt.Printf("  Deleting %s: %s\n", resourceType, item.Metadata.Name)
			deleteURL := fmt.Sprintf("%s/%s", endpoint, item.Metadata.Name)
			if err := c.makeRequest("DELETE", deleteURL, nil); err != nil {
				// Silently skip deletion errors
			} else {
				deletedCount++
			}
		}
	}
}

func main() {
	flag.Parse()

	client := NewClient(*grafanaURL, *namespace, *user, *password)

	if *cleanupFlag {
		// Cleanup should be silent if endpoints aren't available
		client.deleteResources()
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
	// First, process navigation tree if provided
	if len(config.NavigationTree) > 0 {
		fmt.Println("Creating scope navigations from tree...")
		dashboardCounter := 0
		for _, rootNode := range config.NavigationTree {
			flatNavigations := treeToNavigations(rootNode, []string{}, &dashboardCounter)
			for _, navWithName := range flatNavigations {
				// Use the title from navWithName if Nav.Title is empty
				if navWithName.Nav.Title == "" && navWithName.Title != "" {
					navWithName.Nav.Title = navWithName.Title
				}
				if err := client.createScopeNavigation(navWithName.Name, navWithName.Nav); err != nil {
					fmt.Fprintf(os.Stderr, "Error creating scope navigation %s: %v\n", navWithName.Name, err)
					os.Exit(1)
				}
			}
		}
		fmt.Println()
	}

	// Also support flat navigations format for backward compatibility
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
