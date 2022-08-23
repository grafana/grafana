package logger

import (
	"fmt"
	"strings"

	"github.com/fatih/color"
)

type CLILogger struct {
	debugMode bool
}

func New(debugMode bool) *CLILogger {
	return &CLILogger{
		debugMode: debugMode,
	}
}

func (l *CLILogger) Successf(format string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s\n\n", color.GreenString("✔"), format), args...)
}

func (l *CLILogger) Failuref(format string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s %s\n\n", color.RedString("Error"), color.RedString("✗"), format), args...)
}

func (l *CLILogger) Info(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}

func (l *CLILogger) Infof(format string, args ...interface{}) {
	fmt.Printf(addNewlines(format), args...)
}

func (l *CLILogger) Debug(args ...interface{}) {
	args = append(args, "\n\n")
	if l.debugMode {
		fmt.Print(color.HiBlueString(fmt.Sprint(args...)))
	}
}

func (l *CLILogger) Debugf(format string, args ...interface{}) {
	if l.debugMode {
		fmt.Print(color.HiBlueString(fmt.Sprintf(addNewlines(format), args...)))
	}
}

func (l *CLILogger) Warn(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}

func (l *CLILogger) Warnf(format string, args ...interface{}) {
	fmt.Printf(addNewlines(format), args...)
}

func (l *CLILogger) Error(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}

func (l *CLILogger) Errorf(format string, args ...interface{}) {
	fmt.Printf(addNewlines(format), args...)
}

func addNewlines(str string) string {
	var s strings.Builder
	s.WriteString(str)
	s.WriteString("\n\n")

	return s.String()
}
