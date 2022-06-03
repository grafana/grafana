package api

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
	"github.com/prometheus/prometheus/pkg/labels"
)

func (srv AlertmanagerSrv) provenanceGuard(currentConfig apimodels.GettableUserConfig, newConfig apimodels.PostableUserConfig) error {
	var reporter cmputil.DiffReporter
	ops := make([]cmp.Option, 0, 4)
	// json.RawMessage is a slice of bytes and therefore cmp's default behavior is to compare it by byte, which is not really useful
	var jsonCmp = cmp.Transformer("", func(in json.RawMessage) string {
		return string(in)
	})
	matcherComparer := cmp.Comparer(func(a, b labels.Matcher) bool {
		if a.Name != b.Name {
			return false
		}
		if a.Value != b.Value {
			return false
		}
		if a.Type != b.Type {
			return false
		}
		return true
	})
	ops = append(ops, cmp.Reporter(&reporter), matcherComparer, jsonCmp, cmpopts.EquateEmpty())
	routesEqual := cmp.Equal(currentConfig.AlertmanagerConfig.Route, newConfig.AlertmanagerConfig.Route, ops...)
	if !routesEqual && currentConfig.AlertmanagerConfig.Route.Provenance != ngmodels.ProvenanceNone {
		srv.log.Debug("diff route", "equal", routesEqual)
		for _, path := range reporter.Diffs.Paths() {
			srv.log.Debug("diff paths", "path", path)
		}
		return errors.New("policies were provisioned and cannot be changed through the UI")
	}
	reporter = cmputil.DiffReporter{}
	ops = make([]cmp.Option, 0, 4)
	ops = append(ops, cmp.Reporter(&reporter), matcherComparer, jsonCmp, cmpopts.EquateEmpty())
	templatesEqual := cmp.Equal(currentConfig.TemplateFiles, newConfig.TemplateFiles, ops...)
	if !templatesEqual {
		for _, path := range reporter.Diffs.Paths() {
			if prov, ok := currentConfig.TemplateFileProvenances[path]; ok {
				if prov != ngmodels.ProvenanceNone {
					return errors.New("template '" + path + "' was provisioned and cannot be changed through the UI")
				}
			}
		}
	}
	if err := validateContactPoints(currentConfig.AlertmanagerConfig.Receivers, newConfig.AlertmanagerConfig.Receivers); err != nil {
		return err
	}
	// reporter = cmputil.DiffReporter{}
	// ops = make([]cmp.Option, 0, 4)
	// ops = append(ops, cmp.Reporter(&reporter), matcherComparer, jsonCmp, cmpopts.EquateEmpty())
	// contactPointsEqual := cmp.Equal(currentConfig.AlertmanagerConfig.Receivers, newConfig.AlertmanagerConfig.Receivers, ops...)
	// if !contactPointsEqual {
	// 	for _, path := range reporter.Diffs.Paths() {
	// 		srv.log.Debug("cp not equal", "path", path)
	// 	}
	// }
	return nil
}

func validateContactPoints(current []*apimodels.GettableApiReceiver, new []*apimodels.PostableApiReceiver) error {
	// todo check if provisioned was deleted
	for _, existingReceiver := range current {
		for _, existingContactPoint := range existingReceiver.GrafanaManagedReceivers {
			found, edited := false, false
		outer:
			for _, postedReceiver := range new {
				fmt.Printf("######## START (%s, %s) ##########\n", existingContactPoint.Name, existingContactPoint.Type)
				for _, postedContactPoint := range postedReceiver.GrafanaManagedReceivers {
					if existingContactPoint.UID != postedContactPoint.UID {
						continue
					}
					found = true
					if existingContactPoint.DisableResolveMessage != postedContactPoint.DisableResolveMessage {
						edited = true
					}
					fmt.Printf("######## (edited == %t) checked resolved \n", edited)
					if existingContactPoint.Name != postedContactPoint.Name {
						edited = true
					}
					fmt.Printf("######## (edited == %t) checked name \n", edited)
					if existingContactPoint.Type != postedContactPoint.Type {
						edited = true
					}
					fmt.Printf("######## (edited == %t) checked type \n", edited)
					for key := range existingContactPoint.SecureFields {
						if value, present := postedContactPoint.SecureSettings[key]; present && value != "" {
							edited = true
							break // it's enough to know that something was edited
						}
					}
					fmt.Printf("######## (edited == %t) checked secure \n", edited)
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
					fmt.Printf("######## (edited == %t) checked settings \n", edited)
					fmt.Printf("######## END (found:%t, edited:%t) ##########\n", found, edited)
					if edited && existingContactPoint.Provenance != ngmodels.ProvenanceNone {
						return errors.New("contact point '" + existingContactPoint.Name + "' was provisioned and cannot be changed through the UI")
					}
					break outer
				}
				fmt.Printf("######## END (found:%t, edited:%t) ##########\n", found, edited)
			}
			if !found && existingContactPoint.Provenance != ngmodels.ProvenanceNone {
				return errors.New("contact point '" + existingContactPoint.Name + "' was provisioned and cannot be changed through the UI")
			}
		}
	}
	return nil
}
