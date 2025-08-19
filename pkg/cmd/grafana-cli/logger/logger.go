package logger

import (
	"fmt"
	"strings"
)

var (
	debugmode = false
)

func Debug(args ...any) {
	if debugmode {
		fmt.Println(args...)
	}
}

func Debugf(fmtString string, args ...any) {
	if debugmode {
		fmt.Printf(addMissingNewline(fmtString), args...)
	}
}

func Error(args ...any) {
	fmt.Println(args...)
}

func Errorf(fmtString string, args ...any) {
	fmt.Printf(addMissingNewline(fmtString), args...)
}

func Info(args ...any) {
	fmt.Println(args...)
}

func Infof(fmtString string, args ...any) {
	fmt.Printf(addMissingNewline(fmtString), args...)
}

func Warn(args ...any) {
	fmt.Println(args...)
}

func Warnf(fmtString string, args ...any) {
	fmt.Printf(addMissingNewline(fmtString), args...)
}

func SetDebug(value bool) {
	debugmode = value
}

func addMissingNewline(s string) string {
	if strings.HasSuffix(s, "\n") {
		return s
	}

	return s + "\n"
}
