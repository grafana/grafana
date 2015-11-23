package gou

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
)

const (
	NOLOGGING = -1
	FATAL     = 0
	ERROR     = 1
	WARN      = 2
	INFO      = 3
	DEBUG     = 4
)

/*
https://github.com/mewkiz/pkg/tree/master/term
RED = '\033[0;1;31m'
GREEN = '\033[0;1;32m'
YELLOW = '\033[0;1;33m'
BLUE = '\033[0;1;34m'
MAGENTA = '\033[0;1;35m'
CYAN = '\033[0;1;36m'
WHITE = '\033[0;1;37m'
DARK_MAGENTA = '\033[0;35m'
ANSI_RESET = '\033[0m'
LogColor         = map[int]string{FATAL: "\033[0m\033[37m",
	ERROR: "\033[0m\033[31m",
	WARN:  "\033[0m\033[33m",
	INFO:  "\033[0m\033[32m",
	DEBUG: "\033[0m\033[34m"}

\e]PFdedede
*/

var (
	LogLevel    int = ERROR
	EMPTY       struct{}
	ErrLogLevel int = ERROR
	logger      *log.Logger
	loggerErr   *log.Logger
	LogColor    = map[int]string{FATAL: "\033[0m\033[37m",
		ERROR: "\033[0m\033[31m",
		WARN:  "\033[0m\033[33m",
		INFO:  "\033[0m\033[35m",
		DEBUG: "\033[0m\033[34m"}
	LogPrefix = map[int]string{
		FATAL: "[FATAL] ",
		ERROR: "[ERROR] ",
		WARN:  "[WARN] ",
		INFO:  "[INFO] ",
		DEBUG: "[DEBUG] ",
	}
	postFix                      = "" //\033[0m
	LogLevelWords map[string]int = map[string]int{"fatal": 0, "error": 1, "warn": 2, "info": 3, "debug": 4, "none": -1}
)

// Setup default logging to Stderr, equivalent to:
//
//	gou.SetLogger(log.New(os.Stderr, "", log.Ltime|log.Lshortfile), "debug")
func SetupLogging(lvl string) {
	SetLogger(log.New(os.Stderr, "", log.LstdFlags|log.Lshortfile|log.Lmicroseconds), strings.ToLower(lvl))
}

// Setup default logging to Stderr, equivalent to:
//
//	gou.SetLogger(log.New(os.Stderr, "", log.LstdFlags|log.Lshortfile|log.Lmicroseconds), level)
func SetupLoggingLong(lvl string) {
	SetLogger(log.New(os.Stderr, "", log.LstdFlags|log.Llongfile|log.Lmicroseconds), strings.ToLower(lvl))
}

// Setup colorized output if this is a terminal
func SetColorIfTerminal() {
	if IsTerminal() {
		SetColorOutput()
	}
}

// Setup colorized output
func SetColorOutput() {
	for lvl, color := range LogColor {
		LogPrefix[lvl] = color
	}
	postFix = "\033[0m"
}

// Setup default log output to go to a dev/null
//
//	log.SetOutput(new(DevNull))
func DiscardStandardLogger() {
	log.SetOutput(new(DevNull))
}

// you can set a logger, and log level,most common usage is:
//
//	gou.SetLogger(log.New(os.Stdout, "", log.LstdFlags), "debug")
//
//  loglevls:   debug, info, warn, error, fatal
// Note, that you can also set a seperate Error Log Level
func SetLogger(l *log.Logger, logLevel string) {
	logger = l
	LogLevelSet(logLevel)
}
func GetLogger() *log.Logger {
	return logger
}

// you can set a logger, and log level.  this is for errors, and assumes
// you are logging to Stderr (seperate from stdout above), allowing you to seperate
// debug&info logging from errors
//
//	gou.SetLogger(log.New(os.Stderr, "", log.LstdFlags), "debug")
//
//  loglevls:   debug, info, warn, error, fatal
func SetErrLogger(l *log.Logger, logLevel string) {
	loggerErr = l
	if lvl, ok := LogLevelWords[logLevel]; ok {
		ErrLogLevel = lvl
	}
}
func GetErrLogger() *log.Logger {
	return logger
}

// sets the log level from a string
func LogLevelSet(levelWord string) {
	if lvl, ok := LogLevelWords[levelWord]; ok {
		LogLevel = lvl
	}
}

// Log at debug level
func Debug(v ...interface{}) {
	if LogLevel >= 4 {
		DoLog(3, DEBUG, fmt.Sprint(v...))
	}
}

// Debug log formatted
func Debugf(format string, v ...interface{}) {
	if LogLevel >= 4 {
		DoLog(3, DEBUG, fmt.Sprintf(format, v...))
	}
}

// Log at info level
func Info(v ...interface{}) {
	if LogLevel >= 3 {
		DoLog(3, INFO, fmt.Sprint(v...))
	}
}

// info log formatted
func Infof(format string, v ...interface{}) {
	if LogLevel >= 3 {
		DoLog(3, INFO, fmt.Sprintf(format, v...))
	}
}

// Log at warn level
func Warn(v ...interface{}) {
	if LogLevel >= 2 {
		DoLog(3, WARN, fmt.Sprint(v...))
	}
}

// Debug log formatted
func Warnf(format string, v ...interface{}) {
	if LogLevel >= 2 {
		DoLog(3, WARN, fmt.Sprintf(format, v...))
	}
}

// Log at error level
func Error(v ...interface{}) {
	if LogLevel >= 1 {
		DoLog(3, ERROR, fmt.Sprint(v...))
	}
}

// Error log formatted
func Errorf(format string, v ...interface{}) {
	if LogLevel >= 1 {
		DoLog(3, ERROR, fmt.Sprintf(format, v...))
	}
}

// Log to logger if setup
//    Log(ERROR, "message")
func Log(logLvl int, v ...interface{}) {
	if LogLevel >= logLvl {
		DoLog(3, logLvl, fmt.Sprint(v...))
	}
}

// Log to logger if setup, grab a stack trace and add that as well
//
//    u.LogTracef(u.ERROR, "message %s", varx)
//
func LogTracef(logLvl int, format string, v ...interface{}) {
	if LogLevel >= logLvl {
		// grab a stack trace
		stackBuf := make([]byte, 6000)
		stackBufLen := runtime.Stack(stackBuf, false)
		stackTraceStr := string(stackBuf[0:stackBufLen])
		parts := strings.Split(stackTraceStr, "\n")
		if len(parts) > 1 {
			v = append(v, strings.Join(parts[3:len(parts)], "\n"))
		}
		DoLog(4, logLvl, fmt.Sprintf(format+"\n%v", v...))
	}
}

// Log to logger if setup
//    Logf(ERROR, "message %d", 20)
func Logf(logLvl int, format string, v ...interface{}) {
	if LogLevel >= logLvl {
		DoLog(3, logLvl, fmt.Sprintf(format, v...))
	}
}

// Log to logger if setup
//    LogP(ERROR, "prefix", "message", anyItems, youWant)
func LogP(logLvl int, prefix string, v ...interface{}) {
	if ErrLogLevel >= logLvl && loggerErr != nil {
		loggerErr.Output(3, prefix+LogPrefix[logLvl]+fmt.Sprint(v...)+postFix)
	} else if LogLevel >= logLvl && logger != nil {
		logger.Output(3, prefix+LogPrefix[logLvl]+fmt.Sprint(v...)+postFix)
	}
}

// Log to logger if setup with a prefix
//    LogPf(ERROR, "prefix", "formatString %s %v", anyItems, youWant)
func LogPf(logLvl int, prefix string, format string, v ...interface{}) {
	if ErrLogLevel >= logLvl && loggerErr != nil {
		loggerErr.Output(3, prefix+LogPrefix[logLvl]+fmt.Sprintf(format, v...)+postFix)
	} else if LogLevel >= logLvl && logger != nil {
		logger.Output(3, prefix+LogPrefix[logLvl]+fmt.Sprintf(format, v...)+postFix)
	}
}

// When you want to use the log short filename flag, and want to use
// the lower level logging functions (say from an *Assert* type function)
// you need to modify the stack depth:
//
//     func init() {}
// 	       SetLogger(log.New(os.Stderr, "", log.Ltime|log.Lshortfile|log.Lmicroseconds), lvl)
//     }
//
//     func assert(t *testing.T, myData) {
//         // we want log line to show line that called this assert, not this line
//         LogD(5, DEBUG, v...)
//     }
func LogD(depth int, logLvl int, v ...interface{}) {
	if LogLevel >= logLvl {
		DoLog(depth, logLvl, fmt.Sprint(v...))
	}
}

// Low level log with depth , level, message and logger
func DoLog(depth, logLvl int, msg string) {
	if ErrLogLevel >= logLvl && loggerErr != nil {
		loggerErr.Output(depth, LogPrefix[logLvl]+msg+postFix)
	} else if LogLevel >= logLvl && logger != nil {
		logger.Output(depth, LogPrefix[logLvl]+msg+postFix)
	}
}

type winsize struct {
	Row    uint16
	Col    uint16
	Xpixel uint16
	Ypixel uint16
}

const (
	_TIOCGWINSZ = 0x5413 // OSX 1074295912
)

//http://play.golang.org/p/5LIA41Iqfp
// Dummy discard, satisfies io.Writer without importing io or os.
type DevNull struct{}

func (DevNull) Write(p []byte) (int, error) {
	return len(p), nil
}
