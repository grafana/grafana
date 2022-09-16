package term

import (
	"bytes"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

var (
	timeFormat     = time.RFC3339Nano
	termTimeFormat = "01-02|15:04:05"
)

const (
	floatFormat = 'f'
	termMsgJust = 40
	errorKey    = "LOG15_ERROR"
)

type terminalLogger struct {
	w io.Writer
}

// NewTerminalLogger returns a logger that encodes keyvals to the Writer in
// a format optimized for human readability on a terminal with color-coded
// level output and terser human friendly timestamp.
// This format should only be used for interactive programs or while developing.
//
//	[TIME] [LEVEL] MESSAGE key=value key=value ...
//
// Example:
//
//	[May 16 20:58:45] [DBUG] remove route ns=haproxy addr=127.0.0.1:50002
func NewTerminalLogger(w io.Writer) gokitlog.Logger {
	return &terminalLogger{w}
}

func (l terminalLogger) Log(keyvals ...interface{}) error {
	r := getRecord(keyvals)

	b := &bytes.Buffer{}

	// To make the log output more readable, we make all log levels 5 characters long
	lvl := fmt.Sprintf("%-5s", strings.ToUpper(r.level.String()))

	if r.color > 0 {
		fmt.Fprintf(b, "\x1b[%dm%s\x1b[0m[%s] %s ", r.color, lvl, r.time.Format(termTimeFormat), r.msg) // lgtm[go/log-injection]
	} else {
		fmt.Fprintf(b, "[%s] [%s] %s ", lvl, r.time.Format(termTimeFormat), r.msg) // lgtm[go/log-injection]
	}

	// try to justify the log output for short messages
	if len(r.keyvals) > 0 && len(r.msg) < termMsgJust {
		b.Write(bytes.Repeat([]byte{' '}, termMsgJust-len(r.msg)))
	}

	// print the keys logfmt style
	logfmt(b, r.keyvals, r.color)
	_, err := l.w.Write(b.Bytes())
	return err
}

type record struct {
	msg     string
	time    time.Time
	level   level.Value
	color   int
	keyvals []interface{}
}

func getRecord(keyvals ...interface{}) *record {
	r := &record{
		color:   0,
		level:   level.InfoValue(),
		keyvals: []interface{}{},
	}

	keyvals = keyvals[0].([]interface{})

	if len(keyvals) == 0 {
		return nil
	}
	if len(keyvals)%2 == 1 {
		keyvals = append(keyvals, nil)
	}
	for i := 0; i < len(keyvals); i += 2 {
		k, v := keyvals[i], keyvals[i+1]

		if k == "t" {
			t, ok := v.(fmt.Stringer)
			if ok {
				parsedTime, err := time.Parse("2006-01-02T15:04:05.999999999-0700", t.String())
				if err == nil {
					r.time = parsedTime
					continue
				} else {
					parsedTime, err := time.Parse(time.RFC3339Nano, t.String())
					if err == nil {
						r.time = parsedTime
						continue
					}
				}
			}

			t3, ok := v.(string)
			if ok {
				// from alerting:        2022-01-26T12:03:41.655107858-08:00
				time, err := time.Parse("2006-01-02T15:04:05.999999999-07:00", t3)
				if err == nil {
					r.time = time
					continue
				}
			}
		}

		if keyvals[i] == "msg" {
			r.msg = v.(string)
			continue
		}

		if k == level.Key() {
			switch v {
			case "trace":
			case level.DebugValue():
				r.level = level.DebugValue()
				r.color = 36
			case level.InfoValue():
				r.level = level.InfoValue()
				r.color = 32
			case level.WarnValue():
				r.level = level.WarnValue()
				r.color = 33
			case level.ErrorValue():
				r.level = level.ErrorValue()
				r.color = 31
			case "crit":
				r.level = level.ErrorValue()
				r.color = 35
			}

			continue
		}

		r.keyvals = append(r.keyvals, k)
		r.keyvals = append(r.keyvals, v)
	}

	return r
}

func logfmt(buf *bytes.Buffer, ctx []interface{}, color int) {
	for i := 0; i < len(ctx); i += 2 {
		if i != 0 {
			buf.WriteByte(' ')
		}

		k, ok := ctx[i].(string)
		v := formatLogfmtValue(ctx[i+1])
		if !ok {
			k, v = errorKey, formatLogfmtValue(k)
		}

		// XXX: we should probably check that all of your key bytes aren't invalid
		if color > 0 {
			fmt.Fprintf(buf, "\x1b[%dm%s\x1b[0m=%s", color, k, v) // lgtm[go/log-injection]
		} else {
			buf.WriteString(k)
			buf.WriteByte('=')
			buf.WriteString(v)
		}
	}

	buf.WriteByte('\n')
}

func formatShared(value interface{}) (result interface{}) {
	defer func() {
		if err := recover(); err != nil {
			if v := reflect.ValueOf(value); v.Kind() == reflect.Ptr && v.IsNil() {
				result = "nil"
			} else {
				panic(err)
			}
		}
	}()

	switch v := value.(type) {
	case time.Time:
		return v.Format(timeFormat)

	case error:
		return v.Error()

	case fmt.Stringer:
		return v.String()

	default:
		return v
	}
}

// formatValue formats a value for serialization
func formatLogfmtValue(value interface{}) string {
	if value == nil {
		return "nil"
	}

	if t, ok := value.(time.Time); ok {
		// Performance optimization: No need for escaping since the provided
		// timeFormat doesn't have any escape characters, and escaping is
		// expensive.
		return t.Format(timeFormat)
	}
	value = formatShared(value)
	switch v := value.(type) {
	case bool:
		return strconv.FormatBool(v)
	case float32:
		return strconv.FormatFloat(float64(v), floatFormat, 3, 64)
	case float64:
		return strconv.FormatFloat(v, floatFormat, 3, 64)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", value)
	case string:
		return escapeString(v)
	default:
		return escapeString(fmt.Sprintf("%+v", value))
	}
}

var stringBufPool = sync.Pool{
	New: func() interface{} { return new(bytes.Buffer) },
}

func escapeString(s string) string {
	needsQuotes := false
	needsEscape := false
	for _, r := range s {
		if r <= ' ' || r == '=' || r == '"' {
			needsQuotes = true
		}
		if r == '\\' || r == '"' || r == '\n' || r == '\r' || r == '\t' {
			needsEscape = true
		}
	}
	if !needsEscape && !needsQuotes {
		return s
	}
	e := stringBufPool.Get().(*bytes.Buffer)
	e.WriteByte('"')
	for _, r := range s {
		switch r {
		case '\\', '"':
			e.WriteByte('\\')
			e.WriteByte(byte(r))
		case '\n':
			e.WriteString("\\n")
		case '\r':
			e.WriteString("\\r")
		case '\t':
			e.WriteString("\\t")
		default:
			e.WriteRune(r)
		}
	}
	e.WriteByte('"')
	var ret string
	if needsQuotes {
		ret = e.String()
	} else {
		ret = string(e.Bytes()[1 : e.Len()-1])
	}
	e.Reset()
	stringBufPool.Put(e)
	return ret
}
