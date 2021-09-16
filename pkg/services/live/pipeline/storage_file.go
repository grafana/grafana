package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
)

// FileStorage can load channel rules from a file on disk.
type FileStorage struct {
	DataPath string
}

func (f *FileStorage) ListRemoteWriteBackends(_ context.Context, orgID int64) ([]RemoteWriteBackend, error) {
	backendBytes, err := ioutil.ReadFile(filepath.Join(f.DataPath, "pipeline", "remote-write-backends.json"))
	if err != nil {
		return nil, fmt.Errorf("can't read ./pipeline/remote-write-backends.json file: %w", err)
	}
	var remoteWriteBackends RemoteWriteBackends
	err = json.Unmarshal(backendBytes, &remoteWriteBackends)
	if err != nil {
		return nil, fmt.Errorf("can't unmarshal remote-write-backends.json data: %w", err)
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
	ruleBytes, err := ioutil.ReadFile(filepath.Join(f.DataPath, "pipeline", "live-channel-rules.json"))
	if err != nil {
		return nil, fmt.Errorf("can't read ./data/live-channel-rules.json file: %w", err)
	}
	var channelRules ChannelRules
	err = json.Unmarshal(ruleBytes, &channelRules)
	if err != nil {
		return nil, fmt.Errorf("can't unmarshal live-channel-rules.json data: %w", err)
	}
	var rules []ChannelRule
	for _, r := range channelRules.Rules {
		if r.OrgId == orgID || (orgID == 1 && r.OrgId == 0) {
			rules = append(rules, r)
		}
	}
	return rules, nil
}
