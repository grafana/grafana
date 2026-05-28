//go:build windows
// +build windows

package log

import (
	"github.com/go-kit/log"
	"gopkg.in/ini.v1"
)

type SysLogHandler struct {
	logger log.Logger
}

func NewSyslog(sec *ini.Section, format Formatedlogger) (*SysLogHandler, error) {
	return &SysLogHandler{}, nil
}

func (sw *SysLogHandler) Log(keyvals ...any) error {
	return nil
}

func (sw *SysLogHandler) Close() error {
	return nil
}
