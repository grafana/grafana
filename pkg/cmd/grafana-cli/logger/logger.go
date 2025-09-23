package logger

import (
	"fmt"
)

var (
	debugmode = false
)

func Debug(args ...any) {
	if debugmode {
		fmt.Print(args...)
	}
}

func Debugf(fmtString string, args ...any) {
	if debugmode {
		fmt.Printf(fmtString, args...)
	}
}

func Error(args ...any) {
	fmt.Print(args...)
}

func Errorf(fmtString string, args ...any) {
	fmt.Printf(fmtString, args...)
}

func Info(args ...any) {
	fmt.Print(args...)
}

func Infof(fmtString string, args ...any) {
	fmt.Printf(fmtString, args...)
}

func Warn(args ...any) {
	fmt.Print(args...)
}

func Warnf(fmtString string, args ...any) {
	fmt.Printf(fmtString, args...)
}

func SetDebug(value bool) {
	debugmode = value
}
