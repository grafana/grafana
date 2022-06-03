package api

import (
	"fmt"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
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
	ops := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty(), cmpopts.IgnoreUnexported(labels.Matcher{})}
	routesEqual := cmp.Equal(currentConfig.AlertmanagerConfig.Route, newConfig.AlertmanagerConfig.Route, ops...)
	if !routesEqual && currentConfig.AlertmanagerConfig.Route.Provenance != ngmodels.ProvenanceNone {
		return fmt.Errorf("policies were provisioned and cannot be changed through the UI")
	}
	return nil
}

func checkTemplates(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	for name, template := range currentConfig.TemplateFiles {
		found := false
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.TemplateFileProvenances[name]; present {
			provenance = prov
		}
		for newName, newTemplate := range newConfig.TemplateFiles {
			if name != newName {
				continue
			}
			found = true
			if template != newTemplate && provenance != ngmodels.ProvenanceNone {
				return fmt.Errorf("template '%s' was provisioned and cannot be changed through the UI", name)
			}
			break // we found the template and we can proceed
		}
		if !found && provenance != ngmodels.ProvenanceNone {
			return fmt.Errorf("template '%s' was provisioned and cannot be changed through the UI", name)
		}
	}
	return nil
}

func checkContactPoints(current []*apimodels.GettableApiReceiver, new []*apimodels.PostableApiReceiver) error {
	for _, existingReceiver := range current {
		for _, existingContactPoint := range existingReceiver.GrafanaManagedReceivers {
			found, edited := false, false
		outer:
			for _, postedReceiver := range new {
				for _, postedContactPoint := range postedReceiver.GrafanaManagedReceivers {
					if existingContactPoint.UID != postedContactPoint.UID {
						continue
					}
					found = true
					if existingContactPoint.DisableResolveMessage != postedContactPoint.DisableResolveMessage {
						edited = true
					}
					if existingContactPoint.Name != postedContactPoint.Name {
						edited = true
					}
					if existingContactPoint.Type != postedContactPoint.Type {
						edited = true
					}
					for key := range existingContactPoint.SecureFields {
						if value, present := postedContactPoint.SecureSettings[key]; present && value != "" {
							edited = true
							break // it's enough to know that something was edited
						}
					}
					existingSettings, err := existingContactPoint.Settings.Map()
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
								edited = true
								break // it's enough to know that something was edited
							}
						} else {
							edited = true
							break // it's enough to know that something was edited
						}
					}
					if edited && existingContactPoint.Provenance != ngmodels.ProvenanceNone {
						return fmt.Errorf("contact point '%s' was provisioned and cannot be changed through the UI", existingContactPoint.Name)
					}
					break outer
				}
			}
			if !found && existingContactPoint.Provenance != ngmodels.ProvenanceNone {
				return fmt.Errorf("contact point '%s' was provisioned and cannot be changed through the UI", existingContactPoint.Name)
			}
		}
	}
	return nil
}

func checkMuteTimes(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	for _, muteTime := range currentConfig.AlertmanagerConfig.MuteTimeIntervals {
		found := false
		provenance := ngmodels.ProvenanceNone
		if prov, present := currentConfig.AlertmanagerConfig.MuteTimeProvenances[muteTime.Name]; present {
			provenance = prov
		}
		for _, newMuteTime := range newConfig.AlertmanagerConfig.MuteTimeIntervals {
			if newMuteTime.Name != muteTime.Name {
				continue
			}
			found = true
			reporter := cmputil.DiffReporter{}
			ops := []cmp.Option{cmp.Reporter(&reporter), cmpopts.EquateEmpty()}
			timesEqual := cmp.Equal(muteTime.TimeIntervals, newMuteTime.TimeIntervals, ops...)
			if !timesEqual && provenance != ngmodels.ProvenanceNone {
				return fmt.Errorf("mute time '%s' was provisioned and cannot be changed through the UI", muteTime.Name)
			}
			break
		}
		if !found && provenance != ngmodels.ProvenanceNone {
			return fmt.Errorf("mute time '%s' was provisioned and cannot be changed through the UI", muteTime.Name)
		}
	}
	return nil
}
