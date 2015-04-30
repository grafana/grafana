// Package slog provides a cross-platform logging interface. It is designed to
// provide a universal logging interface on any operating system. It defaults to
// using the log package of the standard library, but can easily be used with
// other logging backends. Thus, we can use syslog on unicies and the event log
// on windows.
package slog

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

var (
	// LogLineNumber prints the file and line number of the caller.
	LogLineNumber = true
)

// Logger is the slog logging interface.
type Logger interface {
	Error(v string)
	Info(v string)
	Warning(v string)
	Fatal(v string)
}

// StdLog logs to a log.Logger.
type StdLog struct {
	Log *log.Logger
}

// Fatal logs a fatal message and calls os.Exit(1).
func (s *StdLog) Fatal(v string) {
	s.Log.Fatalln("fatal:", rmNl(v))
}

// Error logs an error message.
func (s *StdLog) Error(v string) {
	s.Log.Println("error:", rmNl(v))
}

// Info logs an info message.
func (s *StdLog) Info(v string) {
	s.Log.Println("info:", rmNl(v))
}

// Warning logs a warning message.
func (s *StdLog) Warning(v string) {
	s.Log.Println("warning:", rmNl(v))
}

func rmNl(v string) string {
	if strings.HasSuffix(v, "\n") {
		v = v[:len(v)-1]
	}
	return v
}

var logging Logger = &StdLog{Log: log.New(os.Stderr, "", log.LstdFlags)}

// Set configures l to be the default logger for slog.
func Set(l Logger) {
	logging = l
}

// Info logs an info message.
func Info(v ...interface{}) {
	output(logging.Info, v...)
}

// Infof logs an info message.
func Infof(format string, v ...interface{}) {
	outputf(logging.Info, format, v...)
}

// Infoln logs an info message.
func Infoln(v ...interface{}) {
	outputln(logging.Info, v...)
}

// Warning logs a warning message.
func Warning(v ...interface{}) {
	output(logging.Warning, v...)
}

// Warningf logs a warning message.
func Warningf(format string, v ...interface{}) {
	outputf(logging.Warning, format, v...)
}

// Warningln logs a warning message.
func Warningln(v ...interface{}) {
	outputln(logging.Warning, v...)
}

// Error logs an error message.
func Error(v ...interface{}) {
	output(logging.Error, v...)
}

// Errorf logs an error message.
func Errorf(format string, v ...interface{}) {
	outputf(logging.Error, format, v...)
}

// Errorln logs an error message.
func Errorln(v ...interface{}) {
	outputln(logging.Error, v...)
}

// Fatal logs a fatal message and calls os.Exit(1).
func Fatal(v ...interface{}) {
	output(logging.Fatal, v...)
	// Call os.Exit here just in case the logging package we are using doesn't.
	os.Exit(1)
}

// Fatalf logs a fatal message and calls os.Exit(1).
func Fatalf(format string, v ...interface{}) {
	outputf(logging.Fatal, format, v...)
	os.Exit(1)
}

// Fatalln logs a fatal message and calls os.Exit(1).
func Fatalln(v ...interface{}) {
	outputln(logging.Fatal, v...)
	os.Exit(1)
}

func out(f func(string), s string) {
	if LogLineNumber {
		if _, filename, line, ok := runtime.Caller(3); ok {
			s = fmt.Sprintf("%s:%d: %v", filepath.Base(filename), line, s)
		}
	}
	f(s)
}

func output(f func(string), v ...interface{}) {
	out(f, fmt.Sprint(v...))
}

func outputf(f func(string), format string, v ...interface{}) {
	out(f, fmt.Sprintf(format, v...))
}

func outputln(f func(string), v ...interface{}) {
	out(f, fmt.Sprintln(v...))
}
