package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
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

func (f *FileStorage) CreateChannelRule(_ context.Context, orgID int64, rule ChannelRule) (ChannelRule, error) {
	ruleFile := filepath.Join(f.DataPath, "pipeline", "live-channel-rules.json")

	ruleBytes, err := ioutil.ReadFile(ruleFile)
	if err != nil {
		return rule, fmt.Errorf("can't read ./data/live-channel-rules.json file: %w", err)
	}
	var channelRules ChannelRules
	err = json.Unmarshal(ruleBytes, &channelRules)
	if err != nil {
		return rule, fmt.Errorf("can't unmarshal live-channel-rules.json data: %w", err)
	}

	for _, existingRule := range channelRules.Rules {
		if rule.Pattern == existingRule.Pattern {
			return rule, fmt.Errorf("rule exists: %s", rule.Pattern)
		}
	}

	channelRules.Rules = append(channelRules.Rules, rule)

	file, err := os.OpenFile(ruleFile, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return rule, fmt.Errorf("can't open channel rule file: %w", err)
	}
	defer func() { _ = file.Close() }()
	enc := json.NewEncoder(file)
	enc.SetIndent("", "  ")
	err = enc.Encode(channelRules)
	if err != nil {
		return rule, fmt.Errorf("can't save rules to file: %w", err)
	}
	return rule, nil
}
