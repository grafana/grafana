package backendplugin

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

// HealthStatus is the status of the plugin.
type HealthStatus int

const (
	// HealthStatusUnknown means the status of the plugin is unknown.
	HealthStatusUnknown HealthStatus = iota
	// HealthStatusOk means the status of the plugin is good.
	HealthStatusOk
	// HealthStatusError means the plugin is in an error state.
	HealthStatusError
)

var healthStatusNames = map[int]string{
	0: "UNKNOWN",
	1: "OK",
	2: "ERROR",
}

func (hs HealthStatus) String() string {
	s, exists := healthStatusNames[int(hs)]
	if exists {
		return s
	}
	return strconv.Itoa(int(hs))
}

// CheckHealthResult check health result.
type CheckHealthResult struct {
	Status HealthStatus
	Info   string
}

func checkHealthResultFromProto(protoResp *pluginv2.CheckHealth_Response) *CheckHealthResult {
	status := HealthStatusUnknown
	switch protoResp.Status {
	case pluginv2.CheckHealth_Response_ERROR:
		status = HealthStatusError
	case pluginv2.CheckHealth_Response_OK:
		status = HealthStatusOk
	}

	return &CheckHealthResult{
		Status: status,
		Info:   protoResp.Info,
	}
}

type DataSourceConfig struct {
	ID               int64
	Name             string
	URL              string
	User             string
	Database         string
	BasicAuthEnabled bool
	BasicAuthUser    string
}

type PluginConfig struct {
	OrgID                   int64
	PluginID                string
	PluginType              string
	JSONData                json.RawMessage
	DecryptedSecureJSONData map[string]string
	Updated                 time.Time
	DataSourceConfig        *DataSourceConfig
}

type CallResourceRequest struct {
	Config  PluginConfig
	Path    string
	Method  string
	URL     string
	Headers map[string][]string
	Body    []byte
}

// CallResourceResult call resource result.
type CallResourceResult struct {
	Status  int
	Headers map[string][]string
	Body    []byte
}
