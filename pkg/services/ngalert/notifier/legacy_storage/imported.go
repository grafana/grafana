package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ImportedConfigRevision struct {
	rev            *ConfigRevision
	opts           definition.MergeOpts
	importedConfig *definition.PostableApiAlertingConfig
}

func (rev *ConfigRevision) Imported() (ImportedConfigRevision, error) {
	result := ImportedConfigRevision{
		rev: rev,
	}
	if len(rev.Config.ExtraConfigs) == 0 {
		return result, nil
	}
	// support only one config for now
	mimirCfg := rev.Config.ExtraConfigs[0]
	opts := definition.MergeOpts{
		DedupSuffix:     mimirCfg.Identifier,
		SubtreeMatchers: mimirCfg.MergeMatchers,
	}
	if err := opts.Validate(); err != nil {
		return result, fmt.Errorf("invalid merge options: %w", err)
	}

	mcfg, err := mimirCfg.GetAlertmanagerConfig()
	if err != nil {
		return result, fmt.Errorf("failed to get mimir alertmanager config: %w", err)
	}
	result.importedConfig = &mcfg
	result.opts = opts
	return result, nil
}

func (e ImportedConfigRevision) GetReceivers(uids []string) ([]*models.Receiver, error) {
	if e.importedConfig == nil {
		return nil, nil
	}
	original := e.rev.Config.AlertmanagerConfig.GetReceivers()
	merged, _ := definition.MergeReceivers(original, e.importedConfig.GetReceivers(), e.opts.DedupSuffix)

	capacity := len(uids)
	if capacity == 0 {
		capacity = len(e.importedConfig.Receivers)
	}
	result := make([]*models.Receiver, 0, capacity)
	// merged config contains all receivers from both. We only want the ones from the staged config. However, we need to rename them if necessary.
	for _, r := range merged[len(original):] {
		uid := NameToUid(r.Name)
		if len(uids) > 0 && !slices.Contains(uids, uid) {
			continue
		}
		recv, err := PostableApiReceiverToReceiver(r, models.ProvenanceConvertedPrometheus, models.ResourceOriginImported)
		if err != nil {
			return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
		}
		result = append(result, recv)
	}
	return result, nil
}

func (e ImportedConfigRevision) GetMuteTimeIntervals() ([]config.MuteTimeInterval, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	// Get original imported intervals (before deduplication)
	importedMute := e.importedConfig.GetMuteTimeIntervals()
	importedTime := e.importedConfig.GetTimeIntervals()

	if len(importedMute) == 0 && len(importedTime) == 0 {
		return nil, nil
	}

	// Get Grafana time intervals for merge
	grafanaMute := e.rev.Config.AlertmanagerConfig.MuteTimeIntervals
	grafanaTime := e.rev.Config.AlertmanagerConfig.TimeIntervals

	// Merge to get the renames map (only renamed if name collision occurs)
	_, renames := definition.MergeTimeIntervals(
		grafanaMute,
		grafanaTime,
		importedMute,
		importedTime,
		e.opts.DedupSuffix,
	)

	// Apply renames to imported intervals
	result := make([]config.MuteTimeInterval, 0, len(importedTime)+len(importedMute))

	pushRenamed := func(mt config.MuteTimeInterval) {
		if newName, renamed := renames[mt.Name]; renamed {
			mt.Name = newName
		}
		result = append(result, mt)
	}

	for _, ti := range importedTime {
		pushRenamed(config.MuteTimeInterval(ti))
	}

	for _, mti := range importedMute {
		pushRenamed(mti)
	}

	return result, nil
}

// ReceiverUseByName returns a map of receiver names to the number of times they are used in routes.
func (e ImportedConfigRevision) ReceiverUseByName() map[string]int {
	if e.importedConfig == nil {
		return nil
	}
	m := make(map[string]int)
	receiverUseCounts([]*definitions.Route{e.importedConfig.Route}, m)
	_, renames := definition.MergeReceivers(e.rev.Config.AlertmanagerConfig.GetReceivers(), e.importedConfig.GetReceivers(), e.opts.DedupSuffix)
	for original, renamed := range renames {
		if cnt, ok := m[original]; ok {
			delete(m, original)
			m[renamed] = cnt
		}
	}
	return m
}
