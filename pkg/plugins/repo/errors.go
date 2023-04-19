package repo

import "fmt"

type ErrResponse4xx struct {
	Message    string
	StatusCode int
	systemInfo string
}

func newErrResponse4xx(statusCode int) *ErrResponse4xx {
	return &ErrResponse4xx{
		StatusCode: statusCode,
	}
}

func (e *ErrResponse4xx) WithMessage(message string) *ErrResponse4xx {
	e.Message = message
	return e
}
func (e *ErrResponse4xx) WithSystemInfo(systemInfo string) *ErrResponse4xx {
	e.systemInfo = systemInfo
	return e
}

func (e *ErrResponse4xx) Error() string {
	if len(e.Message) > 0 {
		if len(e.systemInfo) > 0 {
			return fmt.Sprintf("%d: %s (%s)", e.StatusCode, e.Message, e.systemInfo)
		}
		return fmt.Sprintf("%d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("%d", e.StatusCode)
}

type ErrVersionUnsupported struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionUnsupported) Error() string {
	return fmt.Sprintf("%s v%s is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}

type ErrVersionNotFound struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionNotFound) Error() string {
	return fmt.Sprintf("%s v%s either does not exist or is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}

type ErrArcNotFound struct {
	PluginID   string
	SystemInfo string
}

func (e ErrArcNotFound) Error() string {
	return fmt.Sprintf("%s is not compatible with your system architecture: %s", e.PluginID, e.SystemInfo)
}
