package es

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type VersionInfo struct {
	BuildFlavor string `json:"build_flavor"`
}

// ClusterInfo represents Elasticsearch cluster information returned from the root endpoint.
// It is used to determine cluster capabilities and configuration like whether the cluster is serverless.
type ClusterInfo struct {
	Version VersionInfo `json:"version"`
}

const (
	BuildFlavorServerless = "serverless"
)

// GetClusterInfo fetches cluster information from the Elasticsearch root endpoint.
// It returns the cluster build flavor which is used to determine if the cluster is serverless.
func GetClusterInfo(httpCli *http.Client, url string) (ClusterInfo, error) {
	resp, err := httpCli.Get(url)
	if err != nil {
		return ClusterInfo{}, fmt.Errorf("error getting ES cluster info: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return ClusterInfo{}, fmt.Errorf("unexpected status code %d getting ES cluster info", resp.StatusCode)
	}

	defer resp.Body.Close()

	var clusterInfo ClusterInfo
	err = json.NewDecoder(resp.Body).Decode(&clusterInfo)
	if err != nil {
		return ClusterInfo{}, fmt.Errorf("error decoding ES cluster info: %w", err)
	}

	return clusterInfo, nil
}

func (ci ClusterInfo) IsServerless() bool {
	return ci.Version.BuildFlavor == BuildFlavorServerless
}
