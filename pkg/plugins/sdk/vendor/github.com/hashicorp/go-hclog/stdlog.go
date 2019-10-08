package hclog

import (
	"bytes"
	"strings"
)

// Provides a io.Writer to shim the data out of *log.Logger
// and back into our Logger. This is basically the only way to
// build upon *log.Logger.
type stdlogAdapter struct {
	hl          Logger
	inferLevels bool
}

// Take the data, infer the levels if configured, and send it through
// a regular Logger
func (s *stdlogAdapter) Write(data []byte) (int, error) {
	str := string(bytes.TrimRight(data, " \t\n"))

	if s.inferLevels {
		level, str := s.pickLevel(str)
		switch level {
		case Trace:
			s.hl.Trace(str)
		case Debug:
			s.hl.Debug(str)
		case Info:
			s.hl.Info(str)
		case Warn:
			s.hl.Warn(str)
		case Error:
			s.hl.Error(str)
		default:
			s.hl.Info(str)
		}
	} else {
		s.hl.Info(str)
	}

	return len(data), nil
}

// Detect, based on conventions, what log level this is
func (s *stdlogAdapter) pickLevel(str string) (Level, string) {
	switch {
	case strings.HasPrefix(str, "[DEBUG]"):
		return Debug, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[TRACE]"):
		return Trace, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[INFO]"):
		return Info, strings.TrimSpace(str[6:])
	case strings.HasPrefix(str, "[WARN]"):
		return Warn, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[ERROR]"):
		return Error, strings.TrimSpace(str[7:])
	case strings.HasPrefix(str, "[ERR]"):
		return Error, strings.TrimSpace(str[5:])
	default:
		return Info, str
	}
}
