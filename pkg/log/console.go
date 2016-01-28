// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
)

type Brush func(string) string

func NewBrush(color string) Brush {
	pre := "\033["
	reset := "\033[0m"
	return func(text string) string {
		return pre + color + "m" + text + reset
	}
}

var (
	Red    = NewBrush("1;31")
	Purple = NewBrush("1;35")
	Yellow = NewBrush("1;33")
	Green  = NewBrush("1;32")
	Blue   = NewBrush("1;34")
	Cyan   = NewBrush("1;36")

	colors = []Brush{
		Cyan,   // Trace      cyan
		Blue,   // Debug      blue
		Green,  // Info       green
		Yellow, // Warn       yellow
		Red,    // Error      red
		Purple, // Critical   purple
		Red,    // Fatal      red
	}
	consoleWriter = &ConsoleWriter{lg: log.New(os.Stdout, "", 0),
		Level: TRACE}
)

// ConsoleWriter implements LoggerInterface and writes messages to terminal.
type ConsoleWriter struct {
	lg         *log.Logger
	Level      int  `json:"level"`
	Formatting bool `json:"formatting"`
}

// create ConsoleWriter returning as LoggerInterface.
func NewConsole() LoggerInterface {
	return &ConsoleWriter{
		lg:         log.New(os.Stderr, "", log.Ldate|log.Ltime),
		Level:      TRACE,
		Formatting: true,
	}
}

func (cw *ConsoleWriter) Init(config string) error {
	return json.Unmarshal([]byte(config), cw)
}

func (cw *ConsoleWriter) WriteMsg(msg string, skip, level int) error {
	if cw.Level > level {
		return nil
	}
	if runtime.GOOS == "windows" || !cw.Formatting {
		cw.lg.Println(msg)
	} else {
		cw.lg.Println(colors[level](msg))
	}
	return nil
}

func (_ *ConsoleWriter) Flush() {

}

func (_ *ConsoleWriter) Destroy() {
}

func printConsole(level int, msg string) {
	consoleWriter.WriteMsg(msg, 0, level)
}

func printfConsole(level int, format string, v ...interface{}) {
	consoleWriter.WriteMsg(fmt.Sprintf(format, v...), 0, level)
}

// ConsoleTrace prints to stdout using TRACE colors
func ConsoleTrace(s string) {
	printConsole(TRACE, s)
}

// ConsoleTracef prints a formatted string to stdout using TRACE colors
func ConsoleTracef(format string, v ...interface{}) {
	printfConsole(TRACE, format, v...)
}

// ConsoleDebug prints to stdout using DEBUG colors
func ConsoleDebug(s string) {
	printConsole(DEBUG, s)
}

// ConsoleDebugf prints a formatted string to stdout using DEBUG colors
func ConsoleDebugf(format string, v ...interface{}) {
	printfConsole(DEBUG, format, v...)
}

// ConsoleInfo prints to stdout using INFO colors
func ConsoleInfo(s string) {
	printConsole(INFO, s)
}

// ConsoleInfof prints a formatted string to stdout using INFO colors
func ConsoleInfof(format string, v ...interface{}) {
	printfConsole(INFO, format, v...)
}

// ConsoleWarn prints to stdout using WARN colors
func ConsoleWarn(s string) {
	printConsole(WARN, s)
}

// ConsoleWarnf prints a formatted string to stdout using WARN colors
func ConsoleWarnf(format string, v ...interface{}) {
	printfConsole(WARN, format, v...)
}

// ConsoleError prints to stdout using ERROR colors
func ConsoleError(s string) {
	printConsole(ERROR, s)
}

// ConsoleErrorf prints a formatted string to stdout using ERROR colors
func ConsoleErrorf(format string, v ...interface{}) {
	printfConsole(ERROR, format, v...)
}

// ConsoleFatal prints to stdout using FATAL colors
func ConsoleFatal(s string) {
	printConsole(FATAL, s)
	os.Exit(1)
}

// ConsoleFatalf prints a formatted string to stdout using FATAL colors
func ConsoleFatalf(format string, v ...interface{}) {
	printfConsole(FATAL, format, v...)
	os.Exit(1)
}

func init() {
	Register("console", NewConsole)
}
