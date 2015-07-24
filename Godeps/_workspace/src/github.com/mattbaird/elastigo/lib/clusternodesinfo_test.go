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
	"fmt"
	"github.com/bmizerany/assert"
	"testing"
)

func TestGetAll(t *testing.T) {
	InitTests(true)
	c := NewTestConn()
	nodesInfo, err := c.AllNodesInfo()
	assert.T(t, err == nil, fmt.Sprintf("should not have gotten error, received: %v", err))
	assert.T(t, nodesInfo.ClusterName != "", fmt.Sprintf("clustername should have been not empty. received: %q", nodesInfo.ClusterName))
	for _, node := range nodesInfo.Nodes {
		assert.T(t, node.Settings != nil, fmt.Sprintf("Settings should not have been null"))
		assert.T(t, node.OS != nil, fmt.Sprintf("OS should not have been null"))
		assert.T(t, node.Process != nil, fmt.Sprintf("Process should not have been null"))
		assert.T(t, node.JVM != nil, fmt.Sprintf("JVM should not have been null"))
		assert.T(t, node.ThreadPool != nil, fmt.Sprintf("ThreadPool should not have been null"))
		assert.T(t, node.Network != nil, fmt.Sprintf("Network should not have been null"))
		assert.T(t, node.Transport != nil, fmt.Sprintf("Transport should not have been null"))
		assert.T(t, node.Http != nil, fmt.Sprintf("Http should not have been null"))
		assert.T(t, node.Plugins != nil, fmt.Sprintf("Plugins should not have been null"))
	}
}
