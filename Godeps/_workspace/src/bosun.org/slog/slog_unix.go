// +build !windows,!nacl,!plan9

package slog

import "log/syslog"

// SetSyslog configures slog to use the system syslog daemon.
func SetSyslog(tag string) error {
	w, err := syslog.New(syslog.LOG_LOCAL6, tag)
	if err != nil {
		return err
	}
	Set(&Syslog{W: w})
	return nil
}

// Syslog logs to syslog.
type Syslog struct {
	W *syslog.Writer
}

// Fatal logs a fatal message and calls os.Exit(1).
func (s *Syslog) Fatal(v string) {
	s.W.Crit("crit: " + v)
}

// Error logs an error message.
func (s *Syslog) Error(v string) {
	s.W.Err("error: " + v)
}

// Info logs an info message.
func (s *Syslog) Info(v string) {
	// Mac OSX ignores levels info and debug by default, so use notice.
	s.W.Notice("info: " + v)
}

// Warning logs a warning message.
func (s *Syslog) Warning(v string) {
	s.W.Warning("warning: " + v)
}
