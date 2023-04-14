package notifier

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	alertingNotify "github.com/grafana/alerting/notify"
	alertingTemplates "github.com/grafana/alerting/templates"

	"github.com/grafana/grafana/pkg/infra/log"
	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var cfglogger = log.New("notifier.config")

func PersistTemplates(cfg *api.PostableUserConfig, path string) ([]string, bool, error) {
	if len(cfg.TemplateFiles) < 1 {
		return nil, false, nil
	}

	var templatesChanged bool
	pathSet := map[string]struct{}{}
	for name, content := range cfg.TemplateFiles {
		if name != filepath.Base(filepath.Clean(name)) {
			return nil, false, fmt.Errorf("template file name '%s' is not valid", name)
		}

		err := os.MkdirAll(path, 0750)
		if err != nil {
			return nil, false, fmt.Errorf("unable to create template directory %q: %s", path, err)
		}

		file := filepath.Join(path, name)
		pathSet[file] = struct{}{}

		// Check if the template file already exists and if it has changed
		// We can safely ignore gosec here as we've previously checked the filename is clean
		// nolint:gosec
		if tmpl, err := os.ReadFile(file); err == nil && string(tmpl) == content {
			// Templates file is the same we have, no-op and continue.
			continue
		} else if err != nil && !os.IsNotExist(err) {
			return nil, false, err
		}

		// We can safely ignore gosec here as we've previously checked the filename is clean
		// nolint:gosec
		if err := os.WriteFile(file, []byte(content), 0644); err != nil {
			return nil, false, fmt.Errorf("unable to create Alertmanager template file %q: %s", file, err)
		}

		templatesChanged = true
	}

	// Now that we have the list of _actual_ templates, let's remove the ones that we don't need.
	existingFiles, err := os.ReadDir(path)
	if err != nil {
		cfglogger.Error("unable to read directory for deleting Alertmanager templates", "error", err, "path", path)
	}
	for _, existingFile := range existingFiles {
		p := filepath.Join(path, existingFile.Name())
		_, ok := pathSet[p]
		if !ok {
			templatesChanged = true
			err := os.Remove(p)
			if err != nil {
				cfglogger.Error("unable to delete template", "error", err, "file", p)
			}
		}
	}

	paths := make([]string, 0, len(pathSet))
	for path := range pathSet {
		paths = append(paths, path)
	}
	return paths, templatesChanged, nil
}

func Load(rawConfig []byte) (*api.PostableUserConfig, error) {
	cfg := &api.PostableUserConfig{}

	if err := json.Unmarshal(rawConfig, cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	return cfg, nil
}

// AlertingConfiguration provides configuration for an Alertmanager.
// It implements the notify.Configuration interface.
type AlertingConfiguration struct {
	AlertmanagerConfig    api.PostableApiAlertingConfig
	RawAlertmanagerConfig []byte

	AlertmanagerTemplates *alertingTemplates.Template

	IntegrationsFunc         func(receivers []*api.PostableApiReceiver, templates *alertingTemplates.Template) (map[string][]*alertingNotify.Integration, error)
	ReceiverIntegrationsFunc func(r *alertingNotify.GrafanaIntegrationConfig, tmpl *alertingTemplates.Template) (*alertingNotify.Integration, error)
}

func (a AlertingConfiguration) BuildReceiverIntegrationsFunc() func(next *alertingNotify.GrafanaIntegrationConfig, tmpl *alertingTemplates.Template) (alertingNotify.Notifier, error) {
	return func(next *alertingNotify.GrafanaIntegrationConfig, tmpl *alertingTemplates.Template) (alertingNotify.Notifier, error) {
		return a.ReceiverIntegrationsFunc(next, tmpl)
	}
}

func (a AlertingConfiguration) DispatcherLimits() alertingNotify.DispatcherLimits {
	return &nilLimits{}
}

func (a AlertingConfiguration) InhibitRules() []alertingNotify.InhibitRule {
	return a.AlertmanagerConfig.InhibitRules
}

func (a AlertingConfiguration) MuteTimeIntervals() []alertingNotify.MuteTimeInterval {
	return a.AlertmanagerConfig.MuteTimeIntervals
}

func (a AlertingConfiguration) ReceiverIntegrations() (map[string][]*alertingNotify.Integration, error) {
	return a.IntegrationsFunc(a.AlertmanagerConfig.Receivers, a.AlertmanagerTemplates)
}

func (a AlertingConfiguration) RoutingTree() *alertingNotify.Route {
	return a.AlertmanagerConfig.Route.AsAMRoute()
}

func (a AlertingConfiguration) Templates() *alertingTemplates.Template {
	return a.AlertmanagerTemplates
}

func (a AlertingConfiguration) Hash() [16]byte {
	return md5.Sum(a.RawAlertmanagerConfig)
}

func (a AlertingConfiguration) Raw() []byte {
	return a.RawAlertmanagerConfig
}
