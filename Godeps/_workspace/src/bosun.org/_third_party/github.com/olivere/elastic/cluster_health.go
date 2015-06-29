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

// ClusterHealthService allows to get the status of the cluster.
// It is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/cluster-health.html.
type ClusterHealthService struct {
	client                  *Client
	pretty                  bool
	indices                 []string
	waitForStatus           string
	level                   string
	local                   *bool
	masterTimeout           string
	timeout                 string
	waitForActiveShards     *int
	waitForNodes            string
	waitForRelocatingShards *int
}

// NewClusterHealthService creates a new ClusterHealthService.
func NewClusterHealthService(client *Client) *ClusterHealthService {
	return &ClusterHealthService{client: client, indices: make([]string, 0)}
}

// Index limits the information returned to a specific index.
func (s *ClusterHealthService) Index(index string) *ClusterHealthService {
	s.indices = make([]string, 0)
	s.indices = append(s.indices, index)
	return s
}

// Indices limits the information returned to specific indices.
func (s *ClusterHealthService) Indices(indices ...string) *ClusterHealthService {
	s.indices = make([]string, 0)
	s.indices = append(s.indices, indices...)
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *ClusterHealthService) MasterTimeout(masterTimeout string) *ClusterHealthService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout specifies an explicit operation timeout.
func (s *ClusterHealthService) Timeout(timeout string) *ClusterHealthService {
	s.timeout = timeout
	return s
}

// WaitForActiveShards can be used to wait until the specified number of shards are active.
func (s *ClusterHealthService) WaitForActiveShards(waitForActiveShards int) *ClusterHealthService {
	s.waitForActiveShards = &waitForActiveShards
	return s
}

// WaitForNodes can be used to wait until the specified number of nodes are available.
func (s *ClusterHealthService) WaitForNodes(waitForNodes string) *ClusterHealthService {
	s.waitForNodes = waitForNodes
	return s
}

// WaitForRelocatingShards can be used to wait until the specified number of relocating shards is finished.
func (s *ClusterHealthService) WaitForRelocatingShards(waitForRelocatingShards int) *ClusterHealthService {
	s.waitForRelocatingShards = &waitForRelocatingShards
	return s
}

// WaitForStatus can be used to wait until the cluster is in a specific state.
// Valid values are: green, yellow, or red.
func (s *ClusterHealthService) WaitForStatus(waitForStatus string) *ClusterHealthService {
	s.waitForStatus = waitForStatus
	return s
}

// Level specifies the level of detail for returned information.
func (s *ClusterHealthService) Level(level string) *ClusterHealthService {
	s.level = level
	return s
}

// Local indicates whether to return local information. If it is true,
// we do not retrieve the state from master node (default: false).
func (s *ClusterHealthService) Local(local bool) *ClusterHealthService {
	s.local = &local
	return s
}

// buildURL builds the URL for the operation.
func (s *ClusterHealthService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_cluster/health/{index}", map[string]string{
		"index": strings.Join(s.indices, ","),
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.waitForRelocatingShards != nil {
		params.Set("wait_for_relocating_shards", fmt.Sprintf("%d", *s.waitForRelocatingShards))
	}
	if s.waitForStatus != "" {
		params.Set("wait_for_status", s.waitForStatus)
	}
	if s.level != "" {
		params.Set("level", s.level)
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.waitForActiveShards != nil {
		params.Set("wait_for_active_shards", fmt.Sprintf("%d", *s.waitForActiveShards))
	}
	if s.waitForNodes != "" {
		params.Set("wait_for_nodes", s.waitForNodes)
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ClusterHealthService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *ClusterHealthService) Do() (*ClusterHealthResponse, error) {
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
	resp := new(ClusterHealthResponse)
	if err := json.Unmarshal(res.Body, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ClusterHealthResponse is the response of ClusterHealthService.Do.
type ClusterHealthResponse struct {
	ClusterName          string `json:"cluster_name"`
	Status               string `json:"status"`
	TimedOut             bool   `json:"timed_out"`
	NumberOfNodes        int    `json:"number_of_nodes"`
	NumberOfDataNodes    int    `json:"number_of_data_nodes"`
	ActivePrimaryShards  int    `json:"active_primary_shards"`
	ActiveShards         int    `json:"active_shards"`
	RelocatingShards     int    `json:"relocating_shards"`
	InitializingShards   int    `json:"initializing_shards"`
	UnassignedShards     int    `json:"unassigned_shards"`
	NumberOfPendingTasks int    `json:"number_of_pending_tasks"`
}
