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
	importedConfig *v1.ExtraAlertmanagerConfig
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

// GetReceivers returns the imported receivers, optionally filtered by name. Names are matched against the
// receiver names as exposed by Grafana, i.e. after any renames needed to avoid collisions with existing receivers.
func (e ImportedConfigRevision) GetReceivers(names []string) ([]*models.Receiver, error) {
	return e.receivers(func(r v1.PostableApiReceiver) bool {
		return len(names) == 0 || slices.Contains(names, r.Name)
	})
}

// GetReceiver returns the imported receiver with the given UID, or models.ErrReceiverNotFound if there is none.
// Imported receivers have no independent identity of their own, so their UID is derived from their (possibly renamed) name.
// The exception is a collision with an existing UID, which gets a random one that is not stable across calls and so cannot be looked up.
func (e ImportedConfigRevision) GetReceiver(uid string) (*models.Receiver, error) {
	result, err := e.receivers(func(r v1.PostableApiReceiver) bool {
		return string(r.UID) == uid
	})
	if err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, models.ErrReceiverNotFound.Errorf("")
	}
	return result[0], nil
}

func (e ImportedConfigRevision) receivers(match func(v1.PostableApiReceiver) bool) ([]*models.Receiver, error) {
	if e.importedConfig == nil {
		return nil, nil
	}
	imported, err := e.importedConfig.ToGrafanaReceivers()
	if err != nil {
		return nil, err
	}
	merged, _, added := merge.Receivers(e.rev.Config.Receivers, imported, e.identifier)

	result := make([]*models.Receiver, 0, len(added))
	// added contains only the UIDs of the receivers from the staged config, renamed if necessary.
	for _, uid := range added {
		r, ok := merged[uid]
		if !ok || !match(r) {
			continue
		}
		recv, err := PostableApiReceiverToReceiver(r, models.ResourceOriginImported)
		if err != nil {
			return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
		}

		recv.Provenance = models.ProvenanceConvertedPrometheus
		result = append(result, recv)
	}
	return result, nil
}

func (e ImportedConfigRevision) GetTimeIntervals() ([]v1.TimeInterval, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	// Get original imported intervals (before deduplication)
	imported := e.importedConfig.ToGrafanaTimeIntervals()
	if len(imported) == 0 {
		return nil, nil
	}

	// Merge to get the renames map (only renamed if name collision occurs)
	timeIntervals, _, added := merge.TimeIntervals(
		e.rev.Config.TimeIntervals,
		imported,
		e.identifier,
	)

	result := make([]v1.TimeInterval, 0, len(added))
	for _, uid := range added {
		ti, ok := timeIntervals[uid]
		if !ok {
			continue
		}

		ti.SetImported()
		result = append(result, ti)
	}

	return result, nil
}

// ReceiverUseByName returns a map of receiver names to the number of times they are used in routes.
func (e ImportedConfigRevision) ReceiverUseByName() map[string]int {
	if e.importedConfig == nil {
		return nil
	}
	m := make(map[string]int)
	receiverUseCounts([]*v1.Route{e.importedConfig.ToGrafanaRoute()}, m)
	_, renames, _ := merge.Receivers(e.rev.Config.Receivers, e.importedConfig.ReceiverNameStubs(), e.identifier)
	for original, renamed := range renames {
		if cnt, ok := m[original]; ok {
			delete(m, original)
			m[renamed] = cnt
		}
	}
	return m
}

func (e ImportedConfigRevision) GetManagedRoute() (*v1.ManagedRoute, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	route := e.importedConfig.ToGrafanaRoute()

	renamed := merge.DeduplicateResources(*e.rev.Config, *e.importedConfig, e.identifier)

	merge.RenameResourceUsagesInRoutes([]*v1.Route{route}, renamed)

	mr := v1.NewManagedRoute(e.identifier, route)
	mr.SetImported()
	mr.Origin = models.ResourceOriginImported
	return mr, nil
}

func (e ImportedConfigRevision) GetInhibitRules() (map[v1.ResourceUID]v1.InhibitionRule, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	importedRules := e.importedConfig.InhibitRules
	if len(importedRules) == 0 {
		return nil, nil
	}

	// provide the existing inhibition rules from the config so the merged resources names are stable
	merged, addedUIOs, err := merge.MergeInhibitionRules(e.rev.Config.InhibitionRules, importedRules, e.identifier)
	if err != nil {
		return nil, err
	}
	result := make(map[v1.ResourceUID]v1.InhibitionRule, len(addedUIOs))
	for _, uio := range addedUIOs {
		m, ok := merged[v1.ResourceUID(uio)]
		if !ok {
			continue
		}
		m.Provenance = models.ProvenanceConvertedPrometheus
		result[v1.ResourceUID(uio)] = m
	}
	return result, nil
}
