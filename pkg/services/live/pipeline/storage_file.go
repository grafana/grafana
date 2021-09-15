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
	channelRules, err := f.readRules()
	if err != nil {
		return nil, fmt.Errorf("can't read channel rules: %w", err)
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
	channelRules, err := f.readRules()
	if err != nil {
		return rule, fmt.Errorf("can't read channel rules: %w", err)
	}
	for _, existingRule := range channelRules.Rules {
		if rule.Uid == existingRule.Uid {
			return rule, fmt.Errorf("uid already exists: %s", rule.Uid)
		}
		if rule.Pattern == existingRule.Pattern {
			return rule, fmt.Errorf("pattern already exists: %s", rule.Pattern)
		}
	}
	channelRules.Rules = append(channelRules.Rules, rule)
	err = f.saveChannelRules(channelRules)
	return rule, err
}

func (f *FileStorage) UpdateChannelRule(_ context.Context, orgID int64, rule ChannelRule) (ChannelRule, error) {
	channelRules, err := f.readRules()
	if err != nil {
		return rule, fmt.Errorf("can't read channel rules: %w", err)
	}

	index := -1

	for i, existingRule := range channelRules.Rules {
		if rule.Uid == existingRule.Uid {
			index = i
			break
		}
	}
	if index > 0 {
		channelRules.Rules[index] = rule
	} else {
		return rule, fmt.Errorf("rule not found")
	}

	err = f.saveChannelRules(channelRules)
	return rule, err
}

func removeChannelRuleByIndex(s []ChannelRule, index int) []ChannelRule {
	return append(s[:index], s[index+1:]...)
}

func (f *FileStorage) ruleFilePath() string {
	return filepath.Join(f.DataPath, "pipeline", "live-channel-rules.json")
}

func (f *FileStorage) readRules() (ChannelRules, error) {
	ruleFile := f.ruleFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	ruleBytes, err := ioutil.ReadFile(ruleFile)
	if err != nil {
		return ChannelRules{}, fmt.Errorf("can't read ./data/live-channel-rules.json file: %w", err)
	}
	var channelRules ChannelRules
	err = json.Unmarshal(ruleBytes, &channelRules)
	if err != nil {
		return ChannelRules{}, fmt.Errorf("can't unmarshal live-channel-rules.json data: %w", err)
	}
	return channelRules, nil
}

func (f *FileStorage) saveChannelRules(rules ChannelRules) error {
	ruleFile := f.ruleFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	file, err := os.OpenFile(ruleFile, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("can't open channel rule file: %w", err)
	}
	defer func() { _ = file.Close() }()
	enc := json.NewEncoder(file)
	enc.SetIndent("", "  ")
	err = enc.Encode(rules)
	if err != nil {
		return fmt.Errorf("can't save rules to file: %w", err)
	}
	return nil
}

func (f *FileStorage) DeleteChannelRule(_ context.Context, orgID int64, uid string) error {
	channelRules, err := f.readRules()
	if err != nil {
		return fmt.Errorf("can't read channel rules: %w", err)
	}

	index := -1
	for i, existingRule := range channelRules.Rules {
		if uid == existingRule.Uid {
			index = i
			break
		}
	}

	if index > -1 {
		channelRules.Rules = removeChannelRuleByIndex(channelRules.Rules, index)
	} else {
		return fmt.Errorf("rule not found")
	}

	return f.saveChannelRules(channelRules)
}
