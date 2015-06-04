// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// ClusterStateService returns the state of the cluster.
// It is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/cluster-state.html.
type ClusterStateService struct {
	client        *Client
	pretty        bool
	indices       []string
	metrics       []string
	local         *bool
	masterTimeout string
	flatSettings  *bool
}

// NewClusterStateService creates a new ClusterStateService.
func NewClusterStateService(client *Client) *ClusterStateService {
	return &ClusterStateService{
		client:  client,
		indices: make([]string, 0),
		metrics: make([]string, 0),
	}
}

// Index the name of the index. Use _all or an empty string to perform
// the operation on all indices.
func (s *ClusterStateService) Index(index string) *ClusterStateService {
	s.indices = make([]string, 0)
	s.indices = append(s.indices, index)
	return s
}

// Indices is a list of index names. Use _all or an empty string to
// perform the operation on all indices.
func (s *ClusterStateService) Indices(indices ...string) *ClusterStateService {
	s.indices = make([]string, 0)
	s.indices = append(s.indices, indices...)
	return s
}

// Metric limits the information returned to the specified metric.
// It can be one of: version, master_node, nodes, routing_table, metadata,
// blocks, or customs.
func (s *ClusterStateService) Metric(metric string) *ClusterStateService {
	s.metrics = make([]string, 0)
	s.metrics = append(s.metrics, metric)
	return s
}

// Metrics limits the information returned to the specified metrics.
// It can be any of: version, master_node, nodes, routing_table, metadata,
// blocks, or customs.
func (s *ClusterStateService) Metrics(metrics ...string) *ClusterStateService {
	s.metrics = make([]string, 0)
	s.metrics = append(s.metrics, metrics...)
	return s
}

// Local indicates whether to return local information. If it is true,
// we do not retrieve the state from master node (default: false).
func (s *ClusterStateService) Local(local bool) *ClusterStateService {
	s.local = &local
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *ClusterStateService) MasterTimeout(masterTimeout string) *ClusterStateService {
	s.masterTimeout = masterTimeout
	return s
}

// FlatSettings indicates whether to return settings in flat format (default: false).
func (s *ClusterStateService) FlatSettings(flatSettings bool) *ClusterStateService {
	s.flatSettings = &flatSettings
	return s
}

// buildURL builds the URL for the operation.
func (s *ClusterStateService) buildURL() (string, url.Values, error) {
	// Build URL
	metrics := strings.Join(s.metrics, ",")
	if metrics == "" {
		metrics = "_all"
	}
	indices := strings.Join(s.indices, ",")
	if indices == "" {
		indices = "_all"
	}
	path, err := uritemplates.Expand("/_cluster/state/{metrics}/{indices}", map[string]string{
		"metrics": metrics,
		"indices": indices,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ClusterStateService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *ClusterStateService) Do() (*ClusterStateResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest("GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(ClusterStateResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ClusterStateResponse is the response of ClusterStateService.Do.
type ClusterStateResponse struct {
	ClusterName  string                               `json:"cluster_name"`
	Version      int                                  `json:"version"`
	MasterNode   string                               `json:"master_node"`
	Blocks       map[string]interface{}               `json:"blocks"`
	Nodes        map[string]*ClusterStateNode         `json:"nodes"`
	Metadata     *ClusterStateMetadata                `json:"metadata"`
	RoutingTable map[string]*ClusterStateRoutingTable `json:"routing_table"`
	RoutingNodes *ClusterStateRoutingNode             `json:"routing_nodes"`
	Allocations  []interface{}                        `json:"allocations"`
	Customs      map[string]interface{}               `json:"customs"`
}

type ClusterStateMetadata struct {
	Templates    map[string]interface{} `json:"templates"`
	Indices      map[string]interface{} `json:"indices"`
	Repositories map[string]interface{} `json:"repositories"`
}

type ClusterStateNode struct {
	State          string  `json:"state"`
	Primary        bool    `json:"primary"`
	Node           string  `json:"node"`
	RelocatingNode *string `json:"relocating_node"`
	Shard          int     `json:"shard"`
	Index          string  `json:"index"`
}

type ClusterStateRoutingTable struct {
	Indices map[string]interface{} `json:"indices"`
}

type ClusterStateRoutingNode struct {
	Unassigned []interface{}          `json:"unassigned"`
	Nodes      map[string]interface{} `json:"nodes"`
}
