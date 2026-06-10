package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

const apiPath = "/apis/annotation.grafana.app/v0alpha1/namespaces"

// Client is an HTTP client for proxying legacy annotation API requests
// to the new app platform annotations API.
type Client struct {
	baseURL    string
	httpClient *http.Client
	log        log.Logger
}

// NewClient creates a new proxy client for the app platform annotations API.
func NewClient(baseURL string, httpClient *http.Client) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: httpClient,
		log:        log.New("annotations.proxy"),
	}
}

// Annotation mirrors the k8s Annotation resource for JSON serialization.
type Annotation struct {
	APIVersion string             `json:"apiVersion"`
	Kind       string             `json:"kind"`
	Metadata   AnnotationMetadata `json:"metadata"`
	Spec       AnnotationSpec     `json:"spec"`
}

type AnnotationMetadata struct {
	Name              string            `json:"name,omitempty"`
	Namespace         string            `json:"namespace,omitempty"`
	ResourceVersion   string            `json:"resourceVersion,omitempty"`
	CreationTimestamp string            `json:"creationTimestamp,omitempty"`
	Labels            map[string]string `json:"labels,omitempty"`
	Annotations       map[string]string `json:"annotations,omitempty"`
}

type AnnotationSpec struct {
	Text         string   `json:"text"`
	Time         int64    `json:"time"`
	TimeEnd      *int64   `json:"timeEnd,omitempty"`
	DashboardUID *string  `json:"dashboardUID,omitempty"`
	PanelID      *int64   `json:"panelID,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

type AnnotationList struct {
	Items    []Annotation `json:"items"`
	Metadata ListMetadata `json:"metadata"`
}

type ListMetadata struct {
	Continue string `json:"continue,omitempty"`
}

type TagResponse struct {
	Tags []TagItem `json:"tags"`
}

type TagItem struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

// CreateRequest holds the data needed to create an annotation via the new API.
type CreateRequest struct {
	Namespace    string
	Text         string
	Time         int64
	TimeEnd      int64
	DashboardUID string
	PanelID      int64
	Tags         []string
}

// UpdateRequest holds the data needed to update an annotation via the new API.
type UpdateRequest struct {
	Namespace       string
	Name            string // k8s resource name
	ResourceVersion string
	Text            string
	Time            int64
	TimeEnd         int64
	Tags            []string
}

// SearchRequest holds the query parameters for searching annotations.
type SearchRequest struct {
	Namespace    string
	DashboardUID string
	PanelID      int64
	From         int64
	To           int64
	Limit        int64
	Tags         []string
	MatchAny     bool
	LegacyID     int64
}

// TagsRequest holds the query parameters for listing tags.
type TagsRequest struct {
	Namespace string
	Prefix    string
	Limit     int64
}

func (c *Client) annotationsURL(namespace string) string {
	return fmt.Sprintf("%s%s/%s/annotations", c.baseURL, apiPath, namespace)
}

func (c *Client) annotationURL(namespace, name string) string {
	return fmt.Sprintf("%s%s/%s/annotations/%s", c.baseURL, apiPath, namespace, name)
}

func (c *Client) searchURL(namespace string) string {
	return fmt.Sprintf("%s%s/%s/search", c.baseURL, apiPath, namespace)
}

func (c *Client) tagsURL(namespace string) string {
	return fmt.Sprintf("%s%s/%s/tags", c.baseURL, apiPath, namespace)
}

// Create creates a new annotation in the app platform API and returns the created resource.
func (c *Client) Create(ctx context.Context, req CreateRequest) (*Annotation, error) {
	anno := Annotation{
		APIVersion: "annotation.grafana.app/v0alpha1",
		Kind:       "Annotation",
		Spec: AnnotationSpec{
			Text: req.Text,
			Time: req.Time,
			Tags: req.Tags,
		},
	}
	if req.TimeEnd > 0 {
		anno.Spec.TimeEnd = &req.TimeEnd
	}
	if req.DashboardUID != "" {
		anno.Spec.DashboardUID = &req.DashboardUID
	}
	if req.PanelID > 0 {
		anno.Spec.PanelID = &req.PanelID
	}

	body, err := json.Marshal(anno)
	if err != nil {
		return nil, fmt.Errorf("marshalling create request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.annotationsURL(req.Namespace), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("building create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	var result Annotation
	if err := c.do(httpReq, http.StatusCreated, &result); err != nil {
		return nil, fmt.Errorf("creating annotation: %w", err)
	}
	return &result, nil
}

// Update performs a full update of an annotation in the app platform API.
func (c *Client) Update(ctx context.Context, req UpdateRequest) (*Annotation, error) {
	anno := Annotation{
		APIVersion: "annotation.grafana.app/v0alpha1",
		Kind:       "Annotation",
		Metadata: AnnotationMetadata{
			Name:            req.Name,
			Namespace:       req.Namespace,
			ResourceVersion: req.ResourceVersion,
		},
		Spec: AnnotationSpec{
			Text: req.Text,
			Time: req.Time,
			Tags: req.Tags,
		},
	}
	if req.TimeEnd > 0 {
		anno.Spec.TimeEnd = &req.TimeEnd
	}

	body, err := json.Marshal(anno)
	if err != nil {
		return nil, fmt.Errorf("marshalling update request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPut, c.annotationURL(req.Namespace, req.Name), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("building update request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	var result Annotation
	if err := c.do(httpReq, http.StatusOK, &result); err != nil {
		return nil, fmt.Errorf("updating annotation: %w", err)
	}
	return &result, nil
}

// Delete removes an annotation by its k8s name.
func (c *Client) Delete(ctx context.Context, namespace, name string) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.annotationURL(namespace, name), nil)
	if err != nil {
		return fmt.Errorf("building delete request: %w", err)
	}

	if err := c.do(httpReq, http.StatusOK, nil); err != nil {
		return fmt.Errorf("deleting annotation: %w", err)
	}
	return nil
}

// Get retrieves a single annotation by its k8s name.
func (c *Client) Get(ctx context.Context, namespace, name string) (*Annotation, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.annotationURL(namespace, name), nil)
	if err != nil {
		return nil, fmt.Errorf("building get request: %w", err)
	}

	var result Annotation
	if err := c.do(httpReq, http.StatusOK, &result); err != nil {
		return nil, fmt.Errorf("getting annotation: %w", err)
	}
	return &result, nil
}

// Search queries annotations using the custom search endpoint.
func (c *Client) Search(ctx context.Context, req SearchRequest) (*AnnotationList, error) {
	u := c.searchURL(req.Namespace)
	params := url.Values{}
	if req.DashboardUID != "" {
		params.Set("dashboardUID", req.DashboardUID)
	}
	if req.PanelID > 0 {
		params.Set("panelID", strconv.FormatInt(req.PanelID, 10))
	}
	if req.From > 0 {
		params.Set("from", strconv.FormatInt(req.From, 10))
	}
	if req.To > 0 {
		params.Set("to", strconv.FormatInt(req.To, 10))
	}
	if req.Limit > 0 {
		params.Set("limit", strconv.FormatInt(req.Limit, 10))
	}
	for _, tag := range req.Tags {
		params.Add("tag", tag)
	}
	if req.MatchAny {
		params.Set("tagsMatchAny", "true")
	}
	if req.LegacyID > 0 {
		params.Set("legacyID", strconv.FormatInt(req.LegacyID, 10))
	}
	if encoded := params.Encode(); encoded != "" {
		u += "?" + encoded
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("building search request: %w", err)
	}

	var result AnnotationList
	if err := c.do(httpReq, http.StatusOK, &result); err != nil {
		return nil, fmt.Errorf("searching annotations: %w", err)
	}
	return &result, nil
}

// Tags queries annotation tags using the custom tags endpoint.
func (c *Client) Tags(ctx context.Context, req TagsRequest) (*TagResponse, error) {
	u := c.tagsURL(req.Namespace)
	params := url.Values{}
	if req.Prefix != "" {
		params.Set("prefix", req.Prefix)
	}
	if req.Limit > 0 {
		params.Set("limit", strconv.FormatInt(req.Limit, 10))
	}
	if encoded := params.Encode(); encoded != "" {
		u += "?" + encoded
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("building tags request: %w", err)
	}

	var result TagResponse
	if err := c.do(httpReq, http.StatusOK, &result); err != nil {
		return nil, fmt.Errorf("listing tags: %w", err)
	}
	return &result, nil
}

// GetByLegacyID searches for an annotation by its legacy numeric ID.
// Returns nil if not found.
func (c *Client) GetByLegacyID(ctx context.Context, namespace string, legacyID int64) (*Annotation, error) {
	list, err := c.Search(ctx, SearchRequest{
		Namespace: namespace,
		LegacyID:  legacyID,
		Limit:     1,
	})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, nil
	}
	return &list.Items[0], nil
}

// do executes the HTTP request, checks for the expected status, and decodes the response.
func (c *Client) do(req *http.Request, expectedStatus int, dest any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("executing request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != expectedStatus {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status %d (expected %d): %s", resp.StatusCode, expectedStatus, string(body))
	}

	if dest != nil {
		if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}

// LegacyID extracts the legacy numeric ID from an annotation's labels.
func (a *Annotation) LegacyID() int64 {
	if a.Metadata.Labels == nil {
		return 0
	}
	v, ok := a.Metadata.Labels["grafana.app/legacyID"]
	if !ok {
		return 0
	}
	id, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0
	}
	return id
}
