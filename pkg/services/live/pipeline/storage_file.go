package pipeline

import (
	"context"
	"encoding/json"
	"io/ioutil"
)

// FileStorage can load channel rules from a file on disk.
type FileStorage struct{}

func (f *FileStorage) ListRemoteWriteBackends(_ context.Context, orgID int64) ([]RemoteWriteBackend, error) {
	p := "/home/ryan/workspace/grafana/grafana/data/rules/remotewritebackends.json" // os.Getenv("GF_LIVE_CHANNEL_RULES_FILE")
	backendBytes, _ := ioutil.ReadFile(p)
	var remoteWriteBackends RemoteWriteBackends
	err := json.Unmarshal(backendBytes, &remoteWriteBackends)
	if err != nil {
		return nil, err
	}
	var backends []RemoteWriteBackend
	for _, b := range remoteWriteBackends.Backends {
		if b.OrgId == orgID || (orgID == 1 && b.OrgId == 0) {
			backends = append(backends, b)
		}
	}
	return backends, nil
}

func (f *FileStorage) ListChannelRules(_ context.Context, orgID int64) ([]ChannelRule, error) {
	p := "/home/ryan/workspace/grafana/grafana/data/rules/rules.json" // os.Getenv("GF_LIVE_CHANNEL_RULES_FILE")
	ruleBytes, _ := ioutil.ReadFile(p)
	var channelRules ChannelRules
	err := json.Unmarshal(ruleBytes, &channelRules)
	if err != nil {
		return nil, err
	}
	var rules []ChannelRule
	for _, r := range channelRules.Rules {
		if r.OrgId == orgID || (orgID == 1 && r.OrgId == 0) {
			rules = append(rules, r)
		}
	}
	return rules, nil
}
