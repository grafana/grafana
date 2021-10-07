package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/util"
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

func (f *FileStorage) CreateRemoteWriteBackend(_ context.Context, orgID int64, backend RemoteWriteBackend) (RemoteWriteBackend, error) {
	remoteWriteBackends, err := f.readRemoteWriteBackends()
	if err != nil {
		return backend, fmt.Errorf("can't read remote write backends: %w", err)
	}
	if backend.UID == "" {
		backend.UID = util.GenerateShortUID()
	}
	ok, reason := backend.Valid()
	if !ok {
		return backend, fmt.Errorf("invalid remote write backend: %s", reason)
	}
	for _, existingBackend := range remoteWriteBackends.Backends {
		if uidMatch(orgID, backend.UID, existingBackend) {
			return backend, fmt.Errorf("backend already exists in org: %s", backend.UID)
		}
	}
	remoteWriteBackends.Backends = append(remoteWriteBackends.Backends, backend)
	err = f.saveRemoteWriteBackends(orgID, remoteWriteBackends)
	return backend, err
}

func (f *FileStorage) UpdateRemoteWriteBackend(ctx context.Context, orgID int64, backend RemoteWriteBackend) (RemoteWriteBackend, error) {
	remoteWriteBackends, err := f.readRemoteWriteBackends()
	if err != nil {
		return backend, fmt.Errorf("can't read channel rules: %w", err)
	}

	ok, reason := backend.Valid()
	if !ok {
		return backend, fmt.Errorf("invalid channel rule: %s", reason)
	}

	index := -1

	for i, existingBackend := range remoteWriteBackends.Backends {
		if uidMatch(orgID, backend.UID, existingBackend) {
			index = i
			break
		}
	}
	if index > -1 {
		remoteWriteBackends.Backends[index] = backend
	} else {
		return f.CreateRemoteWriteBackend(ctx, orgID, backend)
	}

	err = f.saveRemoteWriteBackends(orgID, remoteWriteBackends)
	return backend, err
}

func (f *FileStorage) DeleteRemoteWriteBackend(_ context.Context, orgID int64, uid string) error {
	remoteWriteBackends, err := f.readRemoteWriteBackends()
	if err != nil {
		return fmt.Errorf("can't read remote write backends: %w", err)
	}

	index := -1
	for i, existingBackend := range remoteWriteBackends.Backends {
		if uidMatch(orgID, uid, existingBackend) {
			index = i
			break
		}
	}

	if index > -1 {
		remoteWriteBackends.Backends = removeRemoteWriteBackendByIndex(remoteWriteBackends.Backends, index)
	} else {
		return fmt.Errorf("remote write backend not found")
	}

	return f.saveRemoteWriteBackends(orgID, remoteWriteBackends)
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
	ok, reason := rule.Valid()
	if !ok {
		return rule, fmt.Errorf("invalid channel rule: %s", reason)
	}
	for _, existingRule := range channelRules.Rules {
		if patternMatch(orgID, rule.Pattern, existingRule) {
			return rule, fmt.Errorf("pattern already exists in org: %s", rule.Pattern)
		}
	}
	channelRules.Rules = append(channelRules.Rules, rule)
	err = f.saveChannelRules(orgID, channelRules)
	return rule, err
}

func patternMatch(orgID int64, pattern string, existingRule ChannelRule) bool {
	return pattern == existingRule.Pattern && (existingRule.OrgId == orgID || (existingRule.OrgId == 0 && orgID == 1))
}

func uidMatch(orgID int64, uid string, existingBackend RemoteWriteBackend) bool {
	return uid == existingBackend.UID && (existingBackend.OrgId == orgID || (existingBackend.OrgId == 0 && orgID == 1))
}

func (f *FileStorage) UpdateChannelRule(ctx context.Context, orgID int64, rule ChannelRule) (ChannelRule, error) {
	channelRules, err := f.readRules()
	if err != nil {
		return rule, fmt.Errorf("can't read channel rules: %w", err)
	}

	ok, reason := rule.Valid()
	if !ok {
		return rule, fmt.Errorf("invalid channel rule: %s", reason)
	}

	index := -1

	for i, existingRule := range channelRules.Rules {
		if patternMatch(orgID, rule.Pattern, existingRule) {
			index = i
			break
		}
	}
	if index > -1 {
		channelRules.Rules[index] = rule
	} else {
		return f.CreateChannelRule(ctx, orgID, rule)
	}

	err = f.saveChannelRules(orgID, channelRules)
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

func (f *FileStorage) saveChannelRules(orgID int64, rules ChannelRules) error {
	ok, reason := checkRulesValid(orgID, rules.Rules)
	if !ok {
		return errors.New(reason)
	}
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

func (f *FileStorage) DeleteChannelRule(_ context.Context, orgID int64, pattern string) error {
	channelRules, err := f.readRules()
	if err != nil {
		return fmt.Errorf("can't read channel rules: %w", err)
	}

	index := -1
	for i, existingRule := range channelRules.Rules {
		if patternMatch(orgID, pattern, existingRule) {
			index = i
			break
		}
	}

	if index > -1 {
		channelRules.Rules = removeChannelRuleByIndex(channelRules.Rules, index)
	} else {
		return fmt.Errorf("rule not found")
	}

	return f.saveChannelRules(orgID, channelRules)
}

func removeRemoteWriteBackendByIndex(s []RemoteWriteBackend, index int) []RemoteWriteBackend {
	return append(s[:index], s[index+1:]...)
}

func (f *FileStorage) remoteWriteFilePath() string {
	return filepath.Join(f.DataPath, "pipeline", "remote-write-backends.json")
}

func (f *FileStorage) readRemoteWriteBackends() (RemoteWriteBackends, error) {
	filePath := f.remoteWriteFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	bytes, err := ioutil.ReadFile(filePath)
	if err != nil {
		return RemoteWriteBackends{}, fmt.Errorf("can't read %s file: %w", filePath, err)
	}
	var remoteWriteBackends RemoteWriteBackends
	err = json.Unmarshal(bytes, &remoteWriteBackends)
	if err != nil {
		return RemoteWriteBackends{}, fmt.Errorf("can't unmarshal %s data: %w", filePath, err)
	}
	return remoteWriteBackends, nil
}

func (f *FileStorage) saveRemoteWriteBackends(_ int64, remoteWriteBackends RemoteWriteBackends) error {
	filePath := f.remoteWriteFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("can't open channel remote write backends file: %w", err)
	}
	defer func() { _ = file.Close() }()
	enc := json.NewEncoder(file)
	enc.SetIndent("", "  ")
	err = enc.Encode(remoteWriteBackends)
	if err != nil {
		return fmt.Errorf("can't save remote write backends to file: %w", err)
	}
	return nil
}
