// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

var (
	_ = fmt.Print
	_ = log.Print
	_ = strings.Index
	_ = uritemplates.Expand
	_ = url.Parse
)

// NodesInfoService allows to retrieve one or more or all of the
// cluster nodes information.
// It is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/cluster-nodes-info.html.
type NodesInfoService struct {
	client       *Client
	pretty       bool
	nodeId       []string
	metric       []string
	flatSettings *bool
	human        *bool
}

// NewNodesInfoService creates a new NodesInfoService.
func NewNodesInfoService(client *Client) *NodesInfoService {
	return &NodesInfoService{
		client: client,
		nodeId: []string{"_all"},
		metric: []string{"_all"},
	}
}

// NodeId is a list of node IDs or names to limit the returned information.
// Use "_local" to return information from the node you're connecting to,
// leave empty to get information from all nodes.
func (s *NodesInfoService) NodeId(nodeId ...string) *NodesInfoService {
	s.nodeId = make([]string, 0)
	s.nodeId = append(s.nodeId, nodeId...)
	return s
}

// Metric is a list of metrics you wish returned. Leave empty to return all.
// Valid metrics are: settings, os, process, jvm, thread_pool, network,
// transport, http, and plugins.
func (s *NodesInfoService) Metric(metric ...string) *NodesInfoService {
	s.metric = make([]string, 0)
	s.metric = append(s.metric, metric...)
	return s
}

// FlatSettings returns settings in flat format (default: false).
func (s *NodesInfoService) FlatSettings(flatSettings bool) *NodesInfoService {
	s.flatSettings = &flatSettings
	return s
}

// Human indicates whether to return time and byte values in human-readable format.
func (s *NodesInfoService) Human(human bool) *NodesInfoService {
	s.human = &human
	return s
}

// Pretty indicates whether to indent the returned JSON.
func (s *NodesInfoService) Pretty(pretty bool) *NodesInfoService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *NodesInfoService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_nodes/{node_id}/{metric}", map[string]string{
		"node_id": strings.Join(s.nodeId, ","),
		"metric":  strings.Join(s.metric, ","),
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	if s.human != nil {
		params.Set("human", fmt.Sprintf("%v", *s.human))
	}
	if s.pretty {
		params.Set("pretty", "1")
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *NodesInfoService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *NodesInfoService) Do() (*NodesInfoResponse, error) {
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
	ret := new(NodesInfoResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// NodesInfoResponse is the response of NodesInfoService.Do.
type NodesInfoResponse struct {
	ClusterName string                    `json:"cluster_name"`
	Nodes       map[string]*NodesInfoNode `json:"nodes"`
}

type NodesInfoNode struct {
	// Name of the node, e.g. "Mister Fear"
	Name string `json:"name"`
	// TransportAddress, e.g. "inet[/127.0.0.1:9300]"
	TransportAddress string `json:"transport_address"`
	// Host is the host name, e.g. "macbookair"
	Host string `json:"host"`
	// IP is the IP address, e.g. "192.168.1.2"
	IP string `json:"ip"`
	// Version is the Elasticsearch version running on the node, e.g. "1.4.3"
	Version string `json:"version"`
	// Build is the Elasticsearch build, e.g. "36a29a7"
	Build string `json:"build"`
	// HTTPAddress, e.g. "inet[/127.0.0.1:9200]"
	HTTPAddress string `json:"http_address"`
	// HTTPSAddress, e.g. "inet[/127.0.0.1:9200]"
	HTTPSAddress string `json:"https_address"`

	// Settings of the node, e.g. paths and pidfile.
	Settings map[string]interface{} `json:"settings"`

	// OS information, e.g. CPU and memory.
	OS *NodesInfoNodeOS `json:"os"`

	// Process information, e.g. max file descriptors.
	Process *NodesInfoNodeProcess `json:"process"`

	// JVM information, e.g. VM version.
	JVM *NodesInfoNodeProcess `json:"jvm"`

	// ThreadPool information.
	ThreadPool *NodesInfoNodeThreadPool `json:"thread_pool"`

	// Network information.
	Network *NodesInfoNodeNetwork `json:"network"`

	// Network information.
	Transport *NodesInfoNodeTransport `json:"transport"`

	// HTTP information.
	HTTP *NodesInfoNodeHTTP `json:"http"`

	// Plugins information.
	Plugins []*NodesInfoNodePlugin `json:"plugins"`
}

type NodesInfoNodeOS struct {
	RefreshInterval         string `json:"refresh_interval"`           // e.g. 1s
	RefreshIntervalInMillis int    `json:"refresh_interval_in_millis"` // e.g. 1000
	AvailableProcessors     int    `json:"available_processors"`       // e.g. 4

	// CPU information
	CPU struct {
		Vendor           string `json:"vendor"`              // e.g. Intel
		Model            string `json:"model"`               // e.g. iMac15,1
		MHz              int    `json:"mhz"`                 // e.g. 3500
		TotalCores       int    `json:"total_cores"`         // e.g. 4
		TotalSockets     int    `json:"total_sockets"`       // e.g. 4
		CoresPerSocket   int    `json:"cores_per_socket"`    // e.g. 16
		CacheSizeInBytes int    `json:"cache_size_in_bytes"` // e.g. 256
	} `json:"cpu"`

	// Mem information
	Mem struct {
		Total        string `json:"total"`          // e.g. 16gb
		TotalInBytes int    `json:"total_in_bytes"` // e.g. 17179869184
	} `json:"mem"`

	// Swap information
	Swap struct {
		Total        string `json:"total"`          // e.g. 1gb
		TotalInBytes int    `json:"total_in_bytes"` // e.g. 1073741824
	} `json:"swap"`
}

type NodesInfoNodeProcess struct {
	RefreshInterval         string `json:"refresh_interval"`           // e.g. 1s
	RefreshIntervalInMillis int    `json:"refresh_interval_in_millis"` // e.g. 1000
	ID                      int    `json:"id"`                         // process id, e.g. 87079
	MaxFileDescriptors      int    `json:"max_file_descriptors"`       // e.g. 32768
	Mlockall                bool   `json:"mlockall"`                   // e.g. false
}

type NodesInfoNodeJVM struct {
	PID               int       `json:"pid"`        // process id, e.g. 87079
	Version           string    `json:"version"`    // e.g. "1.8.0_25"
	VMName            string    `json:"vm_name"`    // e.g. "Java HotSpot(TM) 64-Bit Server VM"
	VMVersion         string    `json:"vm_version"` // e.g. "25.25-b02"
	VMVendor          string    `json:"vm_vendor"`  // e.g. "Oracle Corporation"
	StartTime         time.Time `json:"start_time"` // e.g. "2015-01-03T15:18:30.982Z"
	StartTimeInMillis int64     `json:"start_time_in_millis"`

	// Mem information
	Mem struct {
		HeapInit           string `json:"heap_init"` // e.g. 1gb
		HeapInitInBytes    int    `json:"heap_init_in_bytes"`
		HeapMax            string `json:"heap_max"` // e.g. 4gb
		HeapMaxInBytes     int    `json:"heap_max_in_bytes"`
		NonHeapInit        string `json:"non_heap_init"` // e.g. 2.4mb
		NonHeapInitInBytes int    `json:"non_heap_init_in_bytes"`
		NonHeapMax         string `json:"non_heap_max"` // e.g. 0b
		NonHeapMaxInBytes  int    `json:"non_heap_max_in_bytes"`
		DirectMax          string `json:"direct_max"` // e.g. 4gb
		DirectMaxInBytes   int    `json:"direct_max_in_bytes"`
	} `json:"mem"`

	GCCollectors []string `json:"gc_collectors"` // e.g. ["ParNew"]
	MemoryPools  []string `json:"memory_pools"`  // e.g. ["Code Cache", "Metaspace"]
}

type NodesInfoNodeThreadPool struct {
	Percolate  *NodesInfoNodeThreadPoolSection `json:"percolate"`
	Bench      *NodesInfoNodeThreadPoolSection `json:"bench"`
	Listener   *NodesInfoNodeThreadPoolSection `json:"listener"`
	Index      *NodesInfoNodeThreadPoolSection `json:"index"`
	Refresh    *NodesInfoNodeThreadPoolSection `json:"refresh"`
	Suggest    *NodesInfoNodeThreadPoolSection `json:"suggest"`
	Generic    *NodesInfoNodeThreadPoolSection `json:"generic"`
	Warmer     *NodesInfoNodeThreadPoolSection `json:"warmer"`
	Search     *NodesInfoNodeThreadPoolSection `json:"search"`
	Flush      *NodesInfoNodeThreadPoolSection `json:"flush"`
	Optimize   *NodesInfoNodeThreadPoolSection `json:"optimize"`
	Management *NodesInfoNodeThreadPoolSection `json:"management"`
	Get        *NodesInfoNodeThreadPoolSection `json:"get"`
	Merge      *NodesInfoNodeThreadPoolSection `json:"merge"`
	Bulk       *NodesInfoNodeThreadPoolSection `json:"bulk"`
	Snapshot   *NodesInfoNodeThreadPoolSection `json:"snapshot"`
}

type NodesInfoNodeThreadPoolSection struct {
	Type      string      `json:"type"`       // e.g. fixed
	Min       int         `json:"min"`        // e.g. 4
	Max       int         `json:"max"`        // e.g. 4
	KeepAlive string      `json:"keep_alive"` // e.g. "5m"
	QueueSize interface{} `json:"queue_size"` // e.g. "1k" or -1
}

type NodesInfoNodeNetwork struct {
	RefreshInterval         string `json:"refresh_interval"`           // e.g. 1s
	RefreshIntervalInMillis int    `json:"refresh_interval_in_millis"` // e.g. 1000
	PrimaryInterface        struct {
		Address    string `json:"address"`     // e.g. 192.168.1.2
		Name       string `json:"name"`        // e.g. en0
		MACAddress string `json:"mac_address"` // e.g. 11:22:33:44:55:66
	} `json:"primary_interface"`
}

type NodesInfoNodeTransport struct {
	BoundAddress   string `json:"bound_address"`   // e.g. inet[/127.0.0.1:9300]
	PublishAddress string `json:"publish_address"` // e.g. inet[/127.0.0.1:9300]
}

type NodesInfoNodeHTTP struct {
	BoundAddress            string `json:"bound_address"`      // e.g. inet[/127.0.0.1:9300]
	PublishAddress          string `json:"publish_address"`    // e.g. inet[/127.0.0.1:9300]
	MaxContentLength        string `json:"max_content_length"` // e.g. "100mb"
	MaxContentLengthInBytes int64  `json:"max_content_length_in_bytes"`
}

type NodesInfoNodePlugin struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Site        bool   `json:"site"`
	JVM         bool   `json:"jvm"`
	URL         string `json:"url"` // e.g. /_plugin/dummy/
}
