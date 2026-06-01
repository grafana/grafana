package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
)

type ImportedConfigRevision struct {
	identifier     string
	rev            *ConfigRevision
	importedConfig *v1.PostableApiAlertingConfig
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
	result.identifier = mimirCfg.Identifier
	mcfg, err := mimirCfg.GetAlertmanagerConfig()
	if err != nil {
		return result, fmt.Errorf("failed to get mimir alertmanager config: %w", err)
	}
	result.importedConfig = &mcfg
	return result, nil
}

func (e ImportedConfigRevision) GetReceivers(uids []string) ([]*models.Receiver, error) {
	if e.importedConfig == nil {
		return nil, nil
	}
	original := e.rev.Config.AlertmanagerConfig.GetReceivers()
	merged, _ := merge.Receivers(original, e.importedConfig.GetReceivers(), e.identifier)

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

func (e ImportedConfigRevision) GetMuteTimeIntervals() ([]v1.MuteTimeInterval, error) {
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
	_, renames := merge.TimeIntervals(
		grafanaMute,
		grafanaTime,
		importedMute,
		importedTime,
		e.identifier,
	)

	// Apply renames to imported intervals
	result := make([]v1.MuteTimeInterval, 0, len(importedTime)+len(importedMute))

	pushRenamed := func(mt v1.MuteTimeInterval) {
		if newName, renamed := renames[mt.Name]; renamed {
			mt.Name = newName
		}
		result = append(result, mt)
	}

	for _, ti := range importedTime {
		pushRenamed(v1.MuteTimeInterval(ti))
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
	receiverUseCounts([]*v1.Route{e.importedConfig.Route}, m)
	_, renames := merge.Receivers(e.rev.Config.AlertmanagerConfig.GetReceivers(), e.importedConfig.GetReceivers(), e.identifier)
	for original, renamed := range renames {
		if cnt, ok := m[original]; ok {
			delete(m, original)
			m[renamed] = cnt
		}
	}
	return m
}

func (e ImportedConfigRevision) GetManagedRoute() (*ManagedRoute, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	renamed := merge.DeduplicateResources(e.rev.Config.AlertmanagerConfig, *e.importedConfig, e.identifier)

	merge.RenameResourceUsagesInRoutes([]*v1.Route{e.importedConfig.Route}, renamed)

	mr := NewManagedRoute(e.identifier, e.importedConfig.Route)
	mr.Provenance = models.ProvenanceConvertedPrometheus
	mr.Origin = models.ResourceOriginImported
	return mr, nil
}

func (e ImportedConfigRevision) GetInhibitRules() (v1.ManagedInhibitionRules, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	importedRules := e.importedConfig.InhibitRules
	if len(importedRules) == 0 {
		return nil, nil
	}

	return merge.BuildManagedInhibitionRules(e.identifier, importedRules)
}
