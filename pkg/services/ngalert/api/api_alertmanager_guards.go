package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	amConfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

func checkRoutes(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	reporter := cmputil.DiffReporter{}
	options := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty(), cmpopts.IgnoreUnexported(labels.Matcher{}), cmp.Transformer("", func(regexp amConfig.Regexp) any {
		r, _ := regexp.MarshalYAML()
		return r
	})}
	routesEqual := cmp.Equal(currentConfig.AlertmanagerConfig.Route, newConfig.AlertmanagerConfig.Route, options...)
	if !routesEqual && currentConfig.AlertmanagerConfig.Route.Provenance != apimodels.Provenance(ngmodels.ProvenanceNone) {
		return fmt.Errorf("policies were provisioned and cannot be changed through the UI")
	}
	return nil
}

func checkTemplates(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	for name, template := range currentConfig.TemplateFiles {
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.TemplateFileProvenances[name]; present {
			provenance = ngmodels.Provenance(prov)
		}
		if provenance == ngmodels.ProvenanceNone {
			continue // we are only interested in non none
		}
		found := false
		for newName, newTemplate := range newConfig.TemplateFiles {
			if name != newName {
				continue
			}
			found = true
			if template != newTemplate {
				return fmt.Errorf("cannot save provisioned template '%s'", name)
			}
			break // we found the template and we can proceed
		}
		if !found {
			return fmt.Errorf("cannot delete provisioned template '%s'", name)
		}
	}
	return nil
}

func checkContactPoints(currReceivers []*apimodels.GettableApiReceiver, newReceivers []*apimodels.PostableApiReceiver) error {
	delta, err := calculateReceiversDelta(currReceivers, newReceivers)
	if err != nil {
		return err
	}
	delta = delta.ProvisionedSubset()
	if !delta.IsEmpty() {
		return fmt.Errorf("cannot modify provisioned contact points: %v", delta.String())
	}
	return nil
}

// calculateReceiversDelta calculates the changes to receivers between the current and new configuration.
func calculateReceiversDelta(currReceivers []*apimodels.GettableApiReceiver, newReceivers []*apimodels.PostableApiReceiver) (ReceiversDelta, error) {
	newReceiversByName := make(map[string]*apimodels.PostableApiReceiver) // Receiver Name -> Integration UID -> ContactPoint
	for _, postedReceiver := range newReceivers {
		newReceiversByName[postedReceiver.Name] = postedReceiver
	}
	delta := ReceiversDelta{}
	for _, existingReceiver := range currReceivers {
		postedReceiver, present := newReceiversByName[existingReceiver.Name]
		if !present {
			delta.Deleted = append(delta.Deleted, existingReceiver) // Receiver has been deleted.
			continue
		}
		// Keep track of which new receivers existed in the old config so we can add the rest to the created list.
		delete(newReceiversByName, existingReceiver.Name)

		updated, err := receiverUpdated(existingReceiver, postedReceiver)
		if err != nil {
			return ReceiversDelta{}, err
		}
		if updated {
			delta.Updated = append(delta.Updated, existingReceiver) // Integration has been updated.
		}
	}

	for _, postedContactPoint := range newReceiversByName {
		delta.Created = append(delta.Created, postedContactPoint) // New receiver has been added.
	}

	return delta, nil
}

// receiverUpdated returns true if the existing and posted receivers differ.
func receiverUpdated(existing *apimodels.GettableApiReceiver, posted *apimodels.PostableApiReceiver) (bool, error) {
	newCPs := make(map[string]*apimodels.PostableGrafanaReceiver)
	for _, postedContactPoint := range posted.GrafanaManagedReceivers {
		newCPs[postedContactPoint.UID] = postedContactPoint
	}

	// Check if integrations have been modified.
	for _, contactPoint := range existing.GrafanaManagedReceivers {
		postedContactPoint, present := newCPs[contactPoint.UID]
		if !present {
			return true, nil // Integration has been removed.
		}
		// Keep track of which new integrations existed in the old config so we can detect if any new integrations have been added.
		delete(newCPs, contactPoint.UID)

		updated, err := integrationUpdated(contactPoint, postedContactPoint)
		if err != nil {
			return false, err
		}
		if updated {
			return true, nil // Integration has been updated.
		}
	}
	return len(newCPs) > 0, nil // New integrations have been added.
}

// integrationUpdated returns true if the existing and posted integrations differ.
func integrationUpdated(existing *apimodels.GettableGrafanaReceiver, posted *apimodels.PostableGrafanaReceiver) (bool, error) {
	if existing.DisableResolveMessage != posted.DisableResolveMessage {
		return true, nil
	}
	if existing.Name != posted.Name {
		return true, nil
	}
	if existing.Type != posted.Type {
		return true, nil
	}
	for key := range existing.SecureFields {
		if value, present := posted.SecureSettings[key]; present && value != "" {
			return true, nil
		}
	}
	existingSettings := map[string]any{}
	err := json.Unmarshal(existing.Settings, &existingSettings)
	if err != nil {
		return false, err
	}
	newSettings := map[string]any{}
	err = json.Unmarshal(posted.Settings, &newSettings)
	if err != nil {
		return false, err
	}
	d := cmp.Diff(existingSettings, newSettings)
	if len(d) > 0 {
		return true, nil
	}

	return false, nil
}

func checkMuteTimes(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	newMTs := make(map[string]amConfig.MuteTimeInterval)
	for _, newMuteTime := range newConfig.AlertmanagerConfig.MuteTimeIntervals {
		newMTs[newMuteTime.Name] = newMuteTime
	}
	for _, muteTime := range currentConfig.AlertmanagerConfig.MuteTimeIntervals {
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.AlertmanagerConfig.MuteTimeProvenances[muteTime.Name]; present {
			provenance = ngmodels.Provenance(prov)
		}
		if provenance == ngmodels.ProvenanceNone {
			continue // we are only interested in non none
		}
		postedMT, present := newMTs[muteTime.Name]
		if !present {
			return fmt.Errorf("cannot delete provisioned mute time '%s'", muteTime.Name)
		}
		reporter := cmputil.DiffReporter{}
		options := []cmp.Option{
			cmp.Reporter(&reporter),
			cmp.Comparer(func(a, b *time.Location) bool {
				// Check if both are nil or both have the same string representation
				return (a == nil && b == nil) || (a != nil && b != nil && a.String() == b.String())
			}),
			cmpopts.EquateEmpty(),
		}
		timesEqual := cmp.Equal(muteTime.TimeIntervals, postedMT.TimeIntervals, options...)
		if !timesEqual {
			return fmt.Errorf("cannot save provisioned mute time '%s'", muteTime.Name)
		}
	}
	return nil
}

// ReceiversDelta represents the changes to receivers in the alertmanager configuration.
type ReceiversDelta struct {
	Created []*apimodels.PostableApiReceiver
	Updated []*apimodels.GettableApiReceiver
	Deleted []*apimodels.GettableApiReceiver
}

// ProvisionedSubset returns a subset of the delta containing only integrations that were provisioned.
func (d ReceiversDelta) ProvisionedSubset() ReceiversDelta {
	subset := ReceiversDelta{}

	for _, cp := range d.Updated {
		if hasProvisionIntegration(cp) {
			subset.Updated = append(subset.Updated, cp)
		}
	}

	for _, cp := range d.Deleted {
		if hasProvisionIntegration(cp) {
			subset.Deleted = append(subset.Deleted, cp)
		}
	}

	// Don't include created integrations in the subset, as they cannot have been provisioned.
	return subset
}

func hasProvisionIntegration(gettable *apimodels.GettableApiReceiver) bool {
	for _, integration := range gettable.GrafanaManagedReceivers {
		if integration.Provenance != apimodels.Provenance(ngmodels.ProvenanceNone) {
			return true
		}
	}
	return false
}

// IsEmpty returns true if the delta contains no changes.
func (d ReceiversDelta) IsEmpty() bool {
	return len(d.Created) == 0 && len(d.Updated) == 0 && len(d.Deleted) == 0
}

// String returns a human-readable representation of the delta for error messages.
func (d ReceiversDelta) String() string {
	res := strings.Builder{}
	if len(d.Created) > 0 {
		res.WriteString("created: ")
	}
	for i, cp := range d.Created {
		if i > 0 {
			res.WriteString(", ")
		}
		res.WriteString(cp.Name)
	}

	if len(d.Updated) > 0 {
		if res.Len() > 0 {
			res.WriteString(", ")
		}
		res.WriteString("updated: ")
	}
	for i, cp := range d.Updated {
		if i > 0 {
			res.WriteString(", ")
		}
		res.WriteString(cp.Name)
	}

	if len(d.Deleted) > 0 {
		if res.Len() > 0 {
			res.WriteString(", ")
		}
		res.WriteString("deleted: ")
	}
	for i, cp := range d.Deleted {
		if i > 0 {
			res.WriteString(", ")
		}
		res.WriteString(cp.Name)
	}

	return res.String()
}
