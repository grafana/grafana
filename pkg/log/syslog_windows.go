//+build windows

package log

import "github.com/inconshreveable/log15"

type SysLogHandler struct {
}

func NewSyslog() *SysLogHandler {
	return &SysLogHandler{}
}

func (sw *SysLogHandler) Init() error {
	return nil
}

func (sw *SysLogHandler) Log(r *log15.Record) error {
	return nil
}
