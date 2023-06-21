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

func PersistTemplates(logger log.Logger, cfg *api.PostableUserConfig, path string) ([]string, bool, error) {
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
		pathSet[name] = struct{}{}

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
		logger.Error("Unable to read directory for deleting Alertmanager templates", "error", err, "path", path)
	}
	for _, existingFile := range existingFiles {
		p := filepath.Join(path, existingFile.Name())
		_, ok := pathSet[existingFile.Name()]
		if !ok {
			templatesChanged = true
			err := os.Remove(p)
			if err != nil {
				logger.Error("Unable to delete template", "error", err, "file", p)
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
	alertmanagerConfig    api.PostableApiAlertingConfig
	rawAlertmanagerConfig []byte

	receivers                []*alertingNotify.APIReceiver
	receiverIntegrationsFunc func(r *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error)
}

func (a AlertingConfiguration) BuildReceiverIntegrationsFunc() func(next *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error) {
	return func(next *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error) {
		return a.receiverIntegrationsFunc(next, tmpl)
	}
}

func (a AlertingConfiguration) DispatcherLimits() alertingNotify.DispatcherLimits {
	return &nilLimits{}
}

func (a AlertingConfiguration) InhibitRules() []alertingNotify.InhibitRule {
	return a.alertmanagerConfig.InhibitRules
}

func (a AlertingConfiguration) MuteTimeIntervals() []alertingNotify.MuteTimeInterval {
	return a.alertmanagerConfig.MuteTimeIntervals
}

func (a AlertingConfiguration) Receivers() []*alertingNotify.APIReceiver {
	return a.receivers
}

func (a AlertingConfiguration) RoutingTree() *alertingNotify.Route {
	return a.alertmanagerConfig.Route.AsAMRoute()
}

func (a AlertingConfiguration) Templates() []string {
	return a.alertmanagerConfig.Templates
}

func (a AlertingConfiguration) Hash() [16]byte {
	return md5.Sum(a.rawAlertmanagerConfig)
}

func (a AlertingConfiguration) Raw() []byte {
	return a.rawAlertmanagerConfig
}
