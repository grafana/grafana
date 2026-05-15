package licensing

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// pluginIDValidTypes lists the plugin types accepted as the trailing segment
// of a plugin ID. Extend this slice when a new plugin type is added.
var pluginIDValidTypes = []string{"panel", "datasource", "app"}

// pluginIDPattern enforces the <vendor>-<name>-<type> structure: vendor and
// name are alphanumeric tokens that may contain internal dashes, and type
// must be one of pluginIDValidTypes. Anchored on both ends, so any character
// outside [a-zA-Z0-9-] (separators, NUL, dots) is rejected by construction.
var pluginIDPattern = regexp.MustCompile(
	`^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)+-(?:` + strings.Join(pluginIDValidTypes, "|") + `)$`,
)

// ErrInvalidPluginID is returned when a pluginID cannot be safely used to
// build a license filename — typically because it contains path separators,
// parent-directory references, or NUL bytes.
var ErrInvalidPluginID = errors.New("invalid plugin ID")

// ErrLicensePathNotConfigured is returned when no enterprise license path
// has been configured, so a per-plugin license path cannot be derived.
var ErrLicensePathNotConfigured = errors.New("enterprise license path not configured")

type Service struct {
	licensePath string
	appURL      string
	license     licensing.Licensing
}

func ProvideLicensing(cfg *setting.Cfg, l licensing.Licensing) *Service {
	return &Service{
		licensePath: cfg.EnterpriseLicensePath,
		appURL:      cfg.AppURL,
		license:     l,
	}
}

func (l *Service) Environment() []string {
	var env []string
	if envProvider, ok := l.license.(licensing.LicenseEnvironment); ok {
		for k, v := range envProvider.Environment() {
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
	}
	return env
}

func (l *Service) Edition() string {
	return l.license.Edition()
}

func (l *Service) Path() string {
	return l.licensePath
}

func (l *Service) AppURL() string {
	return l.appURL
}

func (l *Service) ContentDeliveryPrefix() string {
	return l.license.ContentDeliveryPrefix()
}

// PluginLicensePath returns the absolute path of the per-plugin JWT license
// file that lives next to the enterprise license. The pluginID is validated
// to prevent path traversal: any separator, parent reference, or NUL byte
// is rejected.
func (l *Service) PluginLicensePath(pluginID string) (string, error) {
	if err := validatePluginID(pluginID); err != nil {
		return "", err
	}

	enterprisePath := l.Path()
	if enterprisePath == "" {
		return "", ErrLicensePathNotConfigured
	}

	folder, err := filepath.Abs(filepath.Dir(enterprisePath))
	if err != nil {
		return "", fmt.Errorf("resolve license folder: %w", err)
	}

	candidate := filepath.Join(folder, "license-"+pluginID+".jwt")

	// Defense-in-depth: confirm the joined path stays inside the license folder.
	rel, err := filepath.Rel(folder, candidate)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", fmt.Errorf("%w: resolves outside license folder", ErrInvalidPluginID)
	}
	return candidate, nil
}

// validatePluginID enforces the <vendor>-<name>-<type> structure used by
// Grafana plugin IDs. The character set is restricted to alphanumerics and
// dashes, so any input that matches is also safe to interpolate into a
// filename — no separators, parent references, or NUL bytes can pass.
func validatePluginID(pluginID string) error {
	if pluginID == "" {
		return fmt.Errorf("%w: empty", ErrInvalidPluginID)
	}
	if !pluginIDPattern.MatchString(pluginID) {
		return fmt.Errorf("%w: must match <vendor>-<name>-<type> with type in %v", ErrInvalidPluginID, pluginIDValidTypes)
	}
	return nil
}
