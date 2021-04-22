package logger

import (
	"fmt"

	"github.com/fatih/color"
)

type CLILogger struct {
	DebugMode bool
}

func (l *CLILogger) Success(message string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s", color.GreenString("✔"), message), args...)
}

func (l *CLILogger) Failure(message string, args ...interface{}) {
	fmt.Printf(fmt.Sprintf("%s %s %s", color.RedString("Error"), color.RedString("✗"), message), args...)
}

//func (l *CLILogger) Infof(message string, args ...interface{}) {
//	fmt.Printf(message, args...)
//}

func (l *CLILogger) Info(args ...interface{}) {
	fmt.Print(args...)
}

func (l *CLILogger) Debugf(message string, args ...interface{}) {
	if l.DebugMode {
		fmt.Printf(color.BlueString(message), args...)
	}
}

func (l *CLILogger) Debug(args ...interface{}) {
	if l.DebugMode {
		fmt.Print(args...)
	}
}

//func (l *CLILogger) Warnf(message string, args ...interface{}) {
//	fmt.Printf(message, args...)
//}

func (l *CLILogger) Warn(args ...interface{}) {
	fmt.Print(args...)
}

func (l *CLILogger) Errorf(message string, args ...interface{}) {
	fmt.Printf(message, args...)
}

func (l *CLILogger) Error(args ...interface{}) {
	fmt.Print(args...)
}
