package repo

import "fmt"

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

type ErrVersionUnsupported struct {
	pluginID         string
	requestedVersion string
	systemInfo       string
}

func (e ErrVersionUnsupported) Error() string {
	return fmt.Sprintf("%s v%s is not supported on your system (%s)", e.pluginID, e.requestedVersion, e.systemInfo)
}

type ErrVersionNotFound struct {
	pluginID         string
	requestedVersion string
	systemInfo       string
}

func (e ErrVersionNotFound) Error() string {
	return fmt.Sprintf("%s v%s either does not exist or is not supported on your system (%s)", e.pluginID, e.requestedVersion, e.systemInfo)
}

type ErrArcNotFound struct {
	pluginID   string
	systemInfo string
}

func (e ErrArcNotFound) Error() string {
	return fmt.Sprintf("%s is not compatible with your system architecture: %s", e.pluginID, e.systemInfo)
}

type ErrChecksumMismatch struct {
	archiveURL string
}

func (e ErrChecksumMismatch) Error() string {
	return fmt.Sprintf("expected SHA256 checksum does not match the downloaded archive (%s) - please contact security@grafana.com", e.archiveURL)
}
