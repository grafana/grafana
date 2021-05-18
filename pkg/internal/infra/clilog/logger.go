package logger

import (
	"fmt"
)

var (
	debugmode = false
)

func Debug(args ...interface{}) {
	if debugmode {
		fmt.Print(args...)
	}
}

func Debugf(fmtString string, args ...interface{}) {
	if debugmode {
		fmt.Printf(fmtString, args...)
	}
}

func Error(args ...interface{}) {
	fmt.Print(args...)
}

func Errorf(fmtString string, args ...interface{}) {
	fmt.Printf(fmtString, args...)
}

func Info(args ...interface{}) {
	fmt.Print(args...)
}

func Infof(fmtString string, args ...interface{}) {
	fmt.Printf(fmtString, args...)
}

func Warn(args ...interface{}) {
	fmt.Print(args...)
}

func Warnf(fmtString string, args ...interface{}) {
	fmt.Printf(fmtString, args...)
}

func SetDebug(value bool) {
	debugmode = value
}
