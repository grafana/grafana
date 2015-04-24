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
)

// UpdateSettings allows to update cluster wide specific settings. Defaults to Transient setting
// Settings updated can either be persistent (applied cross restarts) or transient (will not survive a full cluster restart).
// http://www.elasticsearch.org/guide/reference/api/admin-cluster-update-settings.html
func (c *Conn) UpdateSettings(settingType string, key string, value int) (ClusterSettingsResponse, error) {
	var retval ClusterSettingsResponse
	if settingType != "transient" && settingType != "persistent" {
		return retval, fmt.Errorf("settingType must be one of transient or persistent, you passed %s", settingType)
	}
	var url string = "/_cluster/state"
	m := map[string]map[string]int{settingType: map[string]int{key: value}}
	body, err := c.DoCommand("PUT", url, nil, m)
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

type ClusterSettingsResponse struct {
	Transient  map[string]int `json:"transient"`
	Persistent map[string]int `json:"persistent"`
}
