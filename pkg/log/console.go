// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"encoding/json"
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

var colors = []Brush{
	NewBrush("1;36"), // Trace      cyan
	NewBrush("1;34"), // Debug      blue
	NewBrush("1;32"), // Info       green
	NewBrush("1;33"), // Warn       yellow
	NewBrush("1;31"), // Error      red
	NewBrush("1;35"), // Critical   purple
	NewBrush("1;31"), // Fatal      red
}

// ConsoleWriter implements LoggerInterface and writes messages to terminal.
type ConsoleWriter struct {
	lg    *log.Logger
	Level int `json:"level"`
}

// create ConsoleWriter returning as LoggerInterface.
func NewConsole() LoggerInterface {
	return &ConsoleWriter{
		lg:    log.New(os.Stdout, "", log.Ldate|log.Ltime),
		Level: TRACE,
	}
}

func (cw *ConsoleWriter) Init(config string) error {
	return json.Unmarshal([]byte(config), cw)
}

func (cw *ConsoleWriter) WriteMsg(msg string, skip, level int) error {
	if cw.Level > level {
		return nil
	}
	if runtime.GOOS == "windows" {
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

func init() {
	Register("console", NewConsole)
}
