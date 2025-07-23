package repo

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

type ErrResponse4xx struct {
	message           string
	statusCode        int
	compatibilityInfo CompatOpts
}

func newErrResponse4xx(statusCode int) ErrResponse4xx {
	return ErrResponse4xx{
		statusCode: statusCode,
	}
}

func (e ErrResponse4xx) Message() string {
	return e.message
}

func (e ErrResponse4xx) StatusCode() int {
	return e.statusCode
}

func (e ErrResponse4xx) withMessage(message string) ErrResponse4xx {
	e.message = message
	return e
}

func (e ErrResponse4xx) withCompatibilityInfo(compatibilityInfo CompatOpts) ErrResponse4xx {
	e.compatibilityInfo = compatibilityInfo
	return e
}

func (e ErrResponse4xx) Error() string {
	if len(e.message) > 0 {
		compatInfo := e.compatibilityInfo.String()
		if len(compatInfo) > 0 {
			return fmt.Sprintf("%d: %s (%s)", e.statusCode, e.message, compatInfo)
		}
		return fmt.Sprintf("%d: %s", e.statusCode, e.message)
	}
	return fmt.Sprintf("%d", e.statusCode)
}

var (
	ErrVersionUnsupportedMsg  = "{{.Public.PluginID}} v{{.Public.Version}} is not supported on your system {{.Public.SysInfo}}"
	ErrVersionUnsupportedBase = errutil.Conflict("plugin.unsupportedVersion").
					MustTemplate(ErrVersionUnsupportedMsg, errutil.WithPublic(ErrVersionUnsupportedMsg))

	ErrVersionNotFoundMsg  = "{{.Public.PluginID}} v{{.Public.Version}} either does not exist or is not supported on your system {{.Public.SysInfo}}"
	ErrVersionNotFoundBase = errutil.NotFound("plugin.versionNotFound").
				MustTemplate(ErrVersionNotFoundMsg, errutil.WithPublic(ErrVersionNotFoundMsg))

	ErrArcNotFoundMsg  = "{{.Public.PluginID}} is not compatible with your system architecture: {{.Public.SysInfo}}"
	ErrArcNotFoundBase = errutil.NotFound("plugin.archNotFound").
				MustTemplate(ErrArcNotFoundMsg, errutil.WithPublic(ErrArcNotFoundMsg))

	ErrChecksumMismatchMsg  = "expected SHA256 checksum ({{.Public.ExpectedSHA256}}) does not match the downloaded archive ({{.Public.ArchiveURL}}) computed SHA256 checksum ({{.Public.ComputedSHA256}}) - please contact security@grafana.com"
	ErrChecksumMismatchBase = errutil.UnprocessableEntity("plugin.checksumMismatch").
				MustTemplate(ErrChecksumMismatchMsg, errutil.WithPublic(ErrChecksumMismatchMsg))

	ErrCorePluginMsg  = "plugin {{.Public.PluginID}} is a core plugin and cannot be installed separately"
	ErrCorePluginBase = errutil.Forbidden("plugin.forbiddenCorePluginInstall").
				MustTemplate(ErrCorePluginMsg, errutil.WithPublic(ErrCorePluginMsg))

	ErrNotCompatibledMsg = "{{.Public.PluginID}} is not compatible with your Grafana version: {{.Public.GrafanaVersion}}"
	ErrNotCompatibleBase = errutil.NotFound("plugin.grafanaVersionNotCompatible").
				MustTemplate(ErrNotCompatibledMsg, errutil.WithPublic(ErrNotCompatibledMsg))
)

func ErrVersionUnsupported(pluginID, requestedVersion, systemInfo string) error {
	return ErrVersionUnsupportedBase.Build(errutil.TemplateData{Public: map[string]any{"PluginID": pluginID, "Version": requestedVersion, "SysInfo": systemInfo}})
}

func ErrVersionNotFound(pluginID, requestedVersion, systemInfo string) error {
	return ErrVersionNotFoundBase.Build(errutil.TemplateData{Public: map[string]any{"PluginID": pluginID, "Version": requestedVersion, "SysInfo": systemInfo}})
}

func ErrArcNotFound(pluginID, systemInfo string) error {
	return ErrArcNotFoundBase.Build(errutil.TemplateData{Public: map[string]any{"PluginID": pluginID, "SysInfo": systemInfo}})
}

func ErrChecksumMismatch(archiveURL, expectedSHA256, computedSHA256 string) error {
	return ErrChecksumMismatchBase.Build(errutil.TemplateData{Public: map[string]any{"ArchiveURL": archiveURL, "ExpectedSHA256": expectedSHA256, "ComputedSHA256": computedSHA256}})
}

func ErrCorePlugin(pluginID string) error {
	return ErrCorePluginBase.Build(errutil.TemplateData{Public: map[string]any{"PluginID": pluginID}})
}

func ErrNoCompatibleVersions(pluginID, grafanaVersion string) error {
	return ErrNotCompatibleBase.Build(errutil.TemplateData{Public: map[string]any{"PluginID": pluginID, "GrafanaVersion": grafanaVersion}})
}
