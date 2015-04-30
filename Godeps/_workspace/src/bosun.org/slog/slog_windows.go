package slog

import (
	"fmt"

	"bosun.org/_third_party/code.google.com/p/winsvc/debug"
)

type eventLog struct {
	l  debug.Log
	id uint32
}

// Sets the logger to a Windows Event Log. Designed for use with the
// code.google.com/p/winsvc/eventlog and code.google.com/p/winsvc/debug
// packages.
func SetEventLog(l debug.Log, eid uint32) {
	Set(&eventLog{l, eid})
}

func (e *eventLog) Fatal(v string) {
	e.l.Error(e.id, fmt.Sprintf("fatal: %s", v))
}

func (e *eventLog) Info(v string) {
	e.l.Info(e.id, fmt.Sprintf("info: %s", v))
}

func (e *eventLog) Warning(v string) {
	e.l.Warning(e.id, fmt.Sprintf("warning: %s", v))
}
func (e *eventLog) Error(v string) {
	e.l.Error(e.id, fmt.Sprintf("error: %s", v))
}
