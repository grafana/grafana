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

// The cluster nodes info API allows to retrieve one or more (or all) of the cluster nodes information.
// information can be one of jvm, process
func (c *Conn) AllNodesInfo() (NodeInfo, error) {
	return c.NodesInfo([]string{"_all"}, "_all")
}

func (c *Conn) NodesInfo(information []string, nodes ...string) (NodeInfo, error) {
	var url string
	var retval NodeInfo
	url = fmt.Sprintf("/_nodes/%s/%s", strings.Join(nodes, ","), strings.Join(information, ","))
	body, err := c.DoCommand("GET", url, nil, nil)
	if err != nil {
		return retval, err
	}
	// marshall into json
	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}
	return retval, err
}

type NodeInfo struct {
	ClusterName string          `json:"cluster_name"`
	Nodes       map[string]Node `json:"nodes"` // node name is random string
}

type Node struct {
	Name             string      `json:"name,omitempty"`
	TransportAddress string      `json:"transport_address,omitempty"`
	Host             string      `json:"host,omitempty"`
	Ip               string      `json:"ip,omitempty"`
	Version          string      `json:"version,omitempty"`
	Build            string      `json:"build,omitempty"`
	Hostname         string      `json:"hostname,omitempty"`
	HttpAddress      string      `json:"http_address,omitempty"`
	Settings         *Settings   `json:"settings,omitempty"`
	OS               *OS         `json:"os,omitempty"`
	Process          *Process    `json:"process,omitempty"`
	JVM              *JVM        `json:"jvm,omitempty"`
	ThreadPool       *ThreadPool `json:"thread_pool,omitempty"`
	Network          *Network    `json:"network,omitempty"`
	Transport        *Transport  `json:"transport,omitempty"`
	Http             *Http       `json:"http,omitempty"`
	Plugins          []*Plugin   `json:"plugins,omitempty"`
}

type Settings struct {
	Path       *Path  `json:"path,omitempty"`
	Foreground string `json:"foreground,omitempty"`
	Name       string `json:"name,omitempty"`
}

type Path struct {
	Logs string `json:"logs,omitempty"`
	home string `json:"home,omitempty"`
}

type Cluster struct {
	Name string `json:"name"`
}

type OS struct {
	RefreshInterval     int `json:"refresh_interval,omitempty"`
	AvailableProcessors int `json:"available_processors,omitempty"`
}

type CPU struct {
	Vendor           string `json:"vendor,omitempty"`
	Model            string `json:"model,omitempty"`
	Mhz              int    `json:"mhz,omitempty"`
	TotalCores       int    `json:"total_cores,omitempty"`
	TotalSockets     int    `json:"total_sockets,omitempty"`
	CoresPerSocket   int    `json:"cores_per_socket,omitempty"`
	CacheSizeInBytes int    `json:"cache_size_in_bytes,omitempty"`
}

type MEM struct {
	TotalInBytes int `json:"total_in_bytes,omitempty"`
}

type SWAP struct {
	TotalInBytes int `json:"total_in_bytes,omitempty"`
}

type Process struct {
	RefreshInterval    int  `json:"refresh_interval,omitempty"`
	Id                 int  `json:"id,omitempty"`
	MaxFileDescriptors int  `json:"max_file_descriptors,omitempty"`
	Mlockall           bool `json:"mlockall,omitempty"`
}

type JVM struct {
	Pid          int      `json:"pid,omitempty"`
	Version      string   `json:"version,omitempty"`
	VMName       string   `json:"vm_name,omitempty"`
	VMVersion    string   `json:"vm_version,omitempty"`
	VMVendor     string   `json:"vm_vendor,omitempty"`
	StartTime    int      `json:"start_time,omitempty"`
	Mem          *JvmMem  `json:"mem,omitempty"`
	GcCollectors []string `json:"gc_collectors,omitempty"`
	MemoryPools  []string `json:"memory_pools,omitempty"`
}

type JvmMem struct {
	HeapInitInBytes    int `json:"heap_init_in_bytes,omitempty"`
	HeapMaxInBytes     int `json:"heap_max_in_bytes,omitempty"`
	NonHeapInitInBytes int `json:"non_heap_init_in_bytes,omitempty"`
	NonHeapMaxInBytes  int `json:"non_heap_max_in_bytes,omitempty"`
	DirectMaxInBytes   int `json:"direct_max_in_bytes,omitempty"`
}

type ThreadPool struct {
	Generic    *ThreadPoolConfig `json:"generic,omitempty"`
	Index      *ThreadPoolConfig `json:"index,omitempty"`
	Get        *ThreadPoolConfig `json:"get,omitempty"`
	Snapshot   *ThreadPoolConfig `json:"snapshot,omitempty"`
	Merge      *ThreadPoolConfig `json:"merge,omitempty"`
	Suggest    *ThreadPoolConfig `json:"suggest,omitempty"`
	Bulk       *ThreadPoolConfig `json:"bulk,omitempty"`
	Optimize   *ThreadPoolConfig `json:"optimize,omitempty"`
	Warmer     *ThreadPoolConfig `json:"warmer,omitempty"`
	Flush      *ThreadPoolConfig `json:"flush,omitempty"`
	Search     *ThreadPoolConfig `json:"search,omitempty"`
	Percolate  *ThreadPoolConfig `json:"percolate,omitempty"`
	Management *ThreadPoolConfig `json:"management,omitempty"`
	Refresh    *ThreadPoolConfig `json:"refresh,omitempty"`
}

type ThreadPoolConfig struct {
	Type      string      `json:"type,omitempty"`
	Min       int         `json:"min,omitempty"`
	Max       int         `json:"max,omitempty"`
	QueueSize interface{} `json:"queue_size,omitempty"` // Either string or -1
	KeepAlive string      `json:"keep_alive,omitempty"`
}

type Network struct {
	RefreshInterval  int        `json:"refresh_interval,omitempty"`
	PrimaryInterface *Interface `json:"primary_interface,omitempty"`
}

type Interface struct {
	Address    string `json:"address,omitempty"`
	Name       string `json:"name,omitempty"`
	MacAddress string `json:"mac_address,omitempty"`
}

type Transport struct {
	BoundAddress   string `json:"bound_address,omitempty"`
	PublishAddress string `json:"publish_address,omitempty"`
}

type Http struct {
	BoundAddress   string `json:"bound_address,omitempty"`
	PublishAddress string `json:"publish_address,omitempty"`
}

type Plugin struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	Site        bool   `json:"site,omitempty"`
	Jvm         bool   `json:"jvm,omitempty"`
	Url         string `json:"url,omitempty"`
}
