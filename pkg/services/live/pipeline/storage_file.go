package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
)

// FileStorage can load channel rules from a file on disk.
type FileStorage struct {
	DataPath       string
	SecretsService secrets.Service
}

func (f *FileStorage) ListWriteConfigs(_ context.Context, orgID int64) ([]WriteConfig, error) {
	writeConfigs, err := f.readWriteConfigs()
	if err != nil {
		return nil, fmt.Errorf("can't read write configs: %w", err)
	}
	var orgConfigs []WriteConfig
	for _, b := range writeConfigs.Configs {
		if b.OrgId == orgID || (orgID == 1 && b.OrgId == 0) {
			orgConfigs = append(orgConfigs, b)
		}
	}
	return orgConfigs, nil
}

func (f *FileStorage) GetWriteConfig(_ context.Context, orgID int64, cmd WriteConfigGetCmd) (WriteConfig, bool, error) {
	writeConfigs, err := f.readWriteConfigs()
	if err != nil {
		return WriteConfig{}, false, fmt.Errorf("can't read write configs: %w", err)
	}
	for _, existingBackend := range writeConfigs.Configs {
		if uidMatch(orgID, cmd.UID, existingBackend) {
			return existingBackend, true, nil
		}
	}
	return WriteConfig{}, false, nil
}

func (f *FileStorage) CreateWriteConfig(ctx context.Context, orgID int64, cmd WriteConfigCreateCmd) (WriteConfig, error) {
	writeConfigs, err := f.readWriteConfigs()
	if err != nil {
		return WriteConfig{}, fmt.Errorf("can't read write configs: %w", err)
	}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}

	secureSettings, err := f.SecretsService.EncryptJsonData(ctx, cmd.SecureSettings, secrets.WithoutScope())
	if err != nil {
		return WriteConfig{}, fmt.Errorf("error encrypting data: %w", err)
	}

	backend := WriteConfig{
		OrgId:          orgID,
		UID:            cmd.UID,
		Settings:       cmd.Settings,
		SecureSettings: secureSettings,
	}

	ok, reason := backend.Valid()
	if !ok {
		return WriteConfig{}, fmt.Errorf("invalid write config: %s", reason)
	}
	for _, existingBackend := range writeConfigs.Configs {
		if uidMatch(orgID, backend.UID, existingBackend) {
			return WriteConfig{}, fmt.Errorf("backend already exists in org: %s", backend.UID)
		}
	}
	writeConfigs.Configs = append(writeConfigs.Configs, backend)
	err = f.saveWriteConfigs(orgID, writeConfigs)
	return backend, err
}

func (f *FileStorage) UpdateWriteConfig(ctx context.Context, orgID int64, cmd WriteConfigUpdateCmd) (WriteConfig, error) {
	writeConfigs, err := f.readWriteConfigs()
	if err != nil {
		return WriteConfig{}, fmt.Errorf("can't read write configs: %w", err)
	}

	secureSettings, err := f.SecretsService.EncryptJsonData(ctx, cmd.SecureSettings, secrets.WithoutScope())
	if err != nil {
		return WriteConfig{}, fmt.Errorf("error encrypting data: %w", err)
	}

	backend := WriteConfig{
		OrgId:          orgID,
		UID:            cmd.UID,
		Settings:       cmd.Settings,
		SecureSettings: secureSettings,
	}

	ok, reason := backend.Valid()
	if !ok {
		return WriteConfig{}, fmt.Errorf("invalid channel rule: %s", reason)
	}

	index := -1

	for i, existingBackend := range writeConfigs.Configs {
		if uidMatch(orgID, backend.UID, existingBackend) {
			index = i
			break
		}
	}
	if index > -1 {
		writeConfigs.Configs[index] = backend
	} else {
		return f.CreateWriteConfig(ctx, orgID, WriteConfigCreateCmd(cmd))
	}

	err = f.saveWriteConfigs(orgID, writeConfigs)
	return backend, err
}

func (f *FileStorage) DeleteWriteConfig(_ context.Context, orgID int64, cmd WriteConfigDeleteCmd) error {
	writeConfigs, err := f.readWriteConfigs()
	if err != nil {
		return fmt.Errorf("can't read write configs: %w", err)
	}

	index := -1
	for i, existingBackend := range writeConfigs.Configs {
		if uidMatch(orgID, cmd.UID, existingBackend) {
			index = i
			break
		}
	}

	if index > -1 {
		writeConfigs.Configs = removeWriteConfigByIndex(writeConfigs.Configs, index)
	} else {
		return fmt.Errorf("write config not found")
	}

	return f.saveWriteConfigs(orgID, writeConfigs)
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

func (f *FileStorage) CreateChannelRule(_ context.Context, orgID int64, cmd ChannelRuleCreateCmd) (ChannelRule, error) {
	channelRules, err := f.readRules()
	if err != nil {
		return ChannelRule{}, fmt.Errorf("can't read channel rules: %w", err)
	}

	rule := ChannelRule{
		OrgId:    orgID,
		Pattern:  cmd.Pattern,
		Settings: cmd.Settings,
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

func uidMatch(orgID int64, uid string, existingBackend WriteConfig) bool {
	return uid == existingBackend.UID && (existingBackend.OrgId == orgID || (existingBackend.OrgId == 0 && orgID == 1))
}

func (f *FileStorage) UpdateChannelRule(ctx context.Context, orgID int64, cmd ChannelRuleUpdateCmd) (ChannelRule, error) {
	channelRules, err := f.readRules()
	if err != nil {
		return ChannelRule{}, fmt.Errorf("can't read channel rules: %w", err)
	}

	rule := ChannelRule{
		OrgId:    orgID,
		Pattern:  cmd.Pattern,
		Settings: cmd.Settings,
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
		return f.CreateChannelRule(ctx, orgID, ChannelRuleCreateCmd(cmd))
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
	ruleBytes, err := os.ReadFile(ruleFile)
	if err != nil {
		return ChannelRules{}, fmt.Errorf("can't read pipeline rules: %s: %w", f.ruleFilePath(), err)
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

func (f *FileStorage) DeleteChannelRule(_ context.Context, orgID int64, cmd ChannelRuleDeleteCmd) error {
	channelRules, err := f.readRules()
	if err != nil {
		return fmt.Errorf("can't read channel rules: %w", err)
	}

	index := -1
	for i, existingRule := range channelRules.Rules {
		if patternMatch(orgID, cmd.Pattern, existingRule) {
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

func removeWriteConfigByIndex(s []WriteConfig, index int) []WriteConfig {
	return append(s[:index], s[index+1:]...)
}

func (f *FileStorage) writeConfigsFilePath() string {
	return filepath.Join(f.DataPath, "pipeline", "write-configs.json")
}

func (f *FileStorage) readWriteConfigs() (WriteConfigs, error) {
	filePath := f.writeConfigsFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return WriteConfigs{}, fmt.Errorf("can't read %s file: %w", filePath, err)
	}
	var writeConfigs WriteConfigs
	err = json.Unmarshal(bytes, &writeConfigs)
	if err != nil {
		return WriteConfigs{}, fmt.Errorf("can't unmarshal %s data: %w", filePath, err)
	}
	return writeConfigs, nil
}

func (f *FileStorage) saveWriteConfigs(_ int64, writeConfigs WriteConfigs) error {
	filePath := f.writeConfigsFilePath()
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("can't open channel write configs file: %w", err)
	}
	defer func() { _ = file.Close() }()
	enc := json.NewEncoder(file)
	enc.SetIndent("", "  ")
	err = enc.Encode(writeConfigs)
	if err != nil {
		return fmt.Errorf("can't save write configs to file: %w", err)
	}
	return nil
}
