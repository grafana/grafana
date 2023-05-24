package api

import (
	"encoding/json"
	"fmt"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	amConfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

func (srv AlertmanagerSrv) provenanceGuard(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	if err := checkRoutes(currentConfig, newConfig); err != nil {
		return err
	}
	if err := checkTemplates(currentConfig, newConfig); err != nil {
		return err
	}
	if err := checkContactPoints(srv.log, currentConfig.AlertmanagerConfig.Receivers, newConfig.AlertmanagerConfig.Receivers); err != nil {
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

func checkContactPoints(l log.Logger, currReceivers []*apimodels.GettableApiReceiver, newReceivers []*apimodels.PostableApiReceiver) error {
	newCPs := make(map[string]*apimodels.PostableGrafanaReceiver)
	for _, postedReceiver := range newReceivers {
		for _, postedContactPoint := range postedReceiver.GrafanaManagedReceivers {
			newCPs[postedContactPoint.UID] = postedContactPoint
		}
	}
	for _, existingReceiver := range currReceivers {
		for _, contactPoint := range existingReceiver.GrafanaManagedReceivers {
			if contactPoint.Provenance == apimodels.Provenance(ngmodels.ProvenanceNone) {
				continue // we are only interested in non none
			}
			postedContactPoint, present := newCPs[contactPoint.UID]
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
			existingSettings := map[string]interface{}{}
			err := json.Unmarshal(contactPoint.Settings, &existingSettings)
			if err != nil {
				return err
			}
			newSettings := map[string]interface{}{}
			err = json.Unmarshal(postedContactPoint.Settings, &newSettings)
			if err != nil {
				return err
			}
			d := cmp.Diff(existingSettings, newSettings)
			if len(d) > 0 {
				l.Warn("Settings of contact point with provenance status cannot be changed via regular API.", "contactPoint", postedContactPoint.Name, "settingsDiff", d, "error", editErr)
				return editErr
			}
		}
	}
	return nil
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
		options := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty()}
		timesEqual := cmp.Equal(muteTime.TimeIntervals, postedMT.TimeIntervals, options...)
		if !timesEqual {
			return fmt.Errorf("cannot save provisioned mute time '%s'", muteTime.Name)
		}
	}
	return nil
}
