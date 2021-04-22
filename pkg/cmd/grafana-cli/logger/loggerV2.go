package logger

import (
	"fmt"

	"github.com/fatih/color"
)

type CLILogger struct {
	DebugMode bool
}

func New(debugMode bool) *CLILogger {
	return &CLILogger{
		DebugMode: debugMode,
	}
}

func (l *CLILogger) Success(message string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s\n\n", color.GreenString("✔"), message), args...)
}

func (l *CLILogger) Failure(message string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s %s\n\n", color.RedString("Error"), color.RedString("✗"), message), args...)
}

func (l *CLILogger) Info(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}

func (l *CLILogger) Debug(args ...interface{}) {
	args = append(args, "\n\n")
	if l.DebugMode {
		fmt.Print(color.HiBlueString(fmt.Sprint(args...)))
	}
}

func (l *CLILogger) Warn(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}

func (l *CLILogger) Error(args ...interface{}) {
	args = append(args, "\n\n")
	fmt.Print(args...)
}
