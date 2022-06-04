package api

import (
	"fmt"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
	amConfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
)

func (srv AlertmanagerSrv) provenanceGuard(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	if err := checkRoutes(currentConfig, newConfig); err != nil {
		return err
	}
	if err := checkTemplates(currentConfig, newConfig); err != nil {
		return err
	}
	if err := checkContactPoints(currentConfig.AlertmanagerConfig.Receivers, newConfig.AlertmanagerConfig.Receivers); err != nil {
		return err
	}
	if err := checkMuteTimes(currentConfig, newConfig); err != nil {
		return err
	}
	return nil
}

func checkRoutes(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	reporter := cmputil.DiffReporter{}
	options := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty(), cmpopts.IgnoreUnexported(labels.Matcher{})}
	routesEqual := cmp.Equal(currentConfig.AlertmanagerConfig.Route, newConfig.AlertmanagerConfig.Route, options...)
	if !routesEqual && currentConfig.AlertmanagerConfig.Route.Provenance != ngmodels.ProvenanceNone {
		return fmt.Errorf("policies were provisioned and cannot be changed through the UI")
	}
	return nil
}

func checkTemplates(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	for name, template := range currentConfig.TemplateFiles {
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.TemplateFileProvenances[name]; present {
			provenance = prov
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
	currentCPs := make(map[string]*apimodels.GettableGrafanaReceiver)
	newCPs := make(map[string]*apimodels.PostableGrafanaReceiver)
	for _, existingReceiver := range currReceivers {
		for _, existingContactPoint := range existingReceiver.GrafanaManagedReceivers {
			if existingContactPoint.Provenance == ngmodels.ProvenanceNone {
				continue // we are only interested in non none
			}
			currentCPs[existingContactPoint.UID] = existingContactPoint
		}
	}
	for _, postedReceiver := range newReceivers {
		for _, postedContactPoint := range postedReceiver.GrafanaManagedReceivers {
			newCPs[postedContactPoint.UID] = postedContactPoint
		}
	}
	for uid, contactPoint := range currentCPs {
		postedContactPoint, present := newCPs[uid]
		if !present {
			return fmt.Errorf("cannot delete provisioned contact point '%s'", contactPoint.Name)
		}
		editErr := fmt.Errorf("cannot save provisioned contact point '%s'", contactPoint.Name)
		if contactPoint.DisableResolveMessage != postedContactPoint.DisableResolveMessage {
			return editErr
		}
		if contactPoint.Name != postedContactPoint.Name {
			return editErr
		}
		if contactPoint.Type != postedContactPoint.Type {
			return editErr
		}
		for key := range contactPoint.SecureFields {
			if value, present := postedContactPoint.SecureSettings[key]; present && value != "" {
				return editErr
			}
		}
		existingSettings, err := contactPoint.Settings.Map()
		if err != nil {
			return err
		}
		newSettings, err := postedContactPoint.Settings.Map()
		if err != nil {
			return err
		}
		for key, val := range existingSettings {
			if newVal, present := newSettings[key]; present {
				if val != newVal {
					return editErr
				}
			} else {
				return editErr
			}
		}
	}
	return nil
}

func checkMuteTimes(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	currentMTs := make(map[string]amConfig.MuteTimeInterval)
	newMTs := make(map[string]amConfig.MuteTimeInterval)
	for _, muteTime := range currentConfig.AlertmanagerConfig.MuteTimeIntervals {
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.AlertmanagerConfig.MuteTimeProvenances[muteTime.Name]; present {
			provenance = prov
		}
		if provenance == ngmodels.ProvenanceNone {
			continue // we are only interested in non none
		}
		currentMTs[muteTime.Name] = muteTime
	}
	for _, newMuteTime := range newConfig.AlertmanagerConfig.MuteTimeIntervals {
		newMTs[newMuteTime.Name] = newMuteTime
	}
	for name, muteTime := range currentMTs {
		postedMT, present := newMTs[name]
		if !present {
			return fmt.Errorf("cannot delete provisioned mute time '%s'", name)
		}
		reporter := cmputil.DiffReporter{}
		options := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty()}
		timesEqual := cmp.Equal(muteTime.TimeIntervals, postedMT.TimeIntervals, options...)
		if !timesEqual {
			return fmt.Errorf("cannot save provisioned mute time '%s'", muteTime.Name)
		}
	}
	return nil
}
