package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/alerting/definition"

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
