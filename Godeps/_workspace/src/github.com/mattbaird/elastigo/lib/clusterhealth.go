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
	"encoding/json"
	"fmt"
	"strings"
)

// The cluster health API allows to get a very simple status on the health of the cluster.
// see http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/cluster-health.html
// TODO: implement wait_for_status, timeout, wait_for_relocating_shards, wait_for_nodes
// TODO: implement level (Can be one of cluster, indices or shards. Controls the details level of the health
// information returned. Defaults to cluster.)
func (c *Conn) Health(indices ...string) (ClusterHealthResponse, error) {
	var url string
	var retval ClusterHealthResponse
	if len(indices) > 0 {
		url = fmt.Sprintf("/_cluster/health/%s", strings.Join(indices, ","))
	} else {
		url = "/_cluster/health"
	}
	body, err := c.DoCommand("GET", url, nil, nil)
	if err != nil {
		return retval, err
	}
	if err == nil {
		// marshall into json
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			return retval, jsonErr
		}
	}
	return retval, err
}

func (c *Conn) WaitForStatus(status string, timeout int, indices ...string) (ClusterHealthResponse, error) {
	var url string
	var retval ClusterHealthResponse
	if len(indices) > 0 {
		url = fmt.Sprintf("/_cluster/health/%s", strings.Join(indices, ","))
	} else {
		url = "/_cluster/health"
	}

	body, err := c.DoCommand("GET", url, map[string]interface{}{
		"wait_for_status": status,
		"timout":          timeout,
	}, nil)

	if err != nil {
		return retval, err
	}

	if err == nil {
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			return retval, jsonErr
		}
	}
	return retval, err
}

type ClusterStateFilter struct {
	FilterNodes        bool
	FilterRoutingTable bool
	FilterMetadata     bool
	FilterBlocks       bool
	FilterIndices      []string
}

func (f ClusterStateFilter) Parameterize() []string {
	var parts []string

	if f.FilterNodes {
		parts = append(parts, "filter_nodes=true")
	}

	if f.FilterRoutingTable {
		parts = append(parts, "filter_routing_table=true")
	}

	if f.FilterMetadata {
		parts = append(parts, "filter_metadata=true")
	}

	if f.FilterBlocks {
		parts = append(parts, "filter_blocks=true")
	}

	if f.FilterIndices != nil && len(f.FilterIndices) > 0 {
		parts = append(parts, strings.Join([]string{"filter_indices=", strings.Join(f.FilterIndices, ",")}, ""))
	}

	return parts
}

func (c *Conn) ClusterState(filter ClusterStateFilter) (ClusterStateResponse, error) {
	var parameters []string
	var url string
	var retval ClusterStateResponse

	parameters = filter.Parameterize()

	url = fmt.Sprintf("/_cluster/state?%s", strings.Join(parameters, "&"))

	body, err := c.DoCommand("GET", url, nil, nil)
	if err != nil {
		return retval, err
	}
	if err == nil {
		// marshall into json
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			return retval, jsonErr
		}
	}
	return retval, err
}
