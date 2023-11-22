package repo

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/errutil"
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
	ErrVersionUnsupportedMsg  = "{ .Public.PluginID } v{ .Public.Version } is not supported on your system { .Public.SysInfo }"
	ErrVersionUnsupportedBase = errutil.NewBase(errutil.StatusConflict, "plugin.unsupportedVersion").
					MustTemplate(ErrVersionUnsupportedMsg, errutil.WithPublic(ErrVersionUnsupportedMsg))
)

func ErrVersionUnsupported(pluginID, requestedVersion, systemInfo string) error {
	return ErrVersionUnsupportedBase.Build(errutil.TemplateData{
		Public: map[string]any{"PluginID": pluginID, "Version": requestedVersion, "SysInfo": systemInfo}})
}

var ErrVersionNotFoundBase = errutil.NewBase(errutil.StatusNotFound, "plugin.versionNotFound",
	errutil.WithPublicMessage("Plugin version not found."))

func ErrVersionNotFound(pluginID, requestedVersion, systemInfo string) error {
	return ErrVersionNotFoundBase.Errorf("%s v%s either does not exist or is not supported on your system (%s)", pluginID, requestedVersion, systemInfo)
}

var ErrArcNotFoundBase = errutil.NewBase(errutil.StatusNotFound, "plugin.archNotFound",
	errutil.WithPublicMessage("Plugin is not compatible with your system architecture."))

func ErrArcNotFound(pluginID, systemInfo string) error {
	return ErrArcNotFoundBase.Errorf("%s is not compatible with your system architecture: %s", pluginID, systemInfo)
}

var ErrChecksumMismatchBase = errutil.NewBase(errutil.StatusInternal, "plugin.checksumMismatch",
	errutil.WithPublicMessage("Plugin SHA256 checksum does not match the downloaded archive - please contact security@grafana.com"))

func ErrChecksumMismatch(archiveURL string) error {
	return ErrChecksumMismatchBase.Errorf("expected SHA256 checksum does not match the downloaded archive (%s) - please contact security@grafana.com", archiveURL)
}

var ErrCorePluginBase = errutil.NewBase(errutil.StatusForbidden, "plugin.forbiddenCorePluginInstall",
	errutil.WithPublicMessage("core plugins cannot be installed separately"))

func ErrCorePlugin(pluginID string) error {
	return ErrCorePluginBase.Errorf("plugin %s is a core plugin and cannot be installed separately", pluginID)
}
