package text

import (
	"encoding"
	"fmt"
	"io"
	"reflect"

	gokitlog "github.com/go-kit/log"
)

type textLogger struct {
	w io.Writer
}

// NewTextLogger similar to gokitlog.NewLogfmtLogger
// but converts unsupported types to string
func NewTextLogger(w io.Writer) gokitlog.Logger {
	return &textLogger{w}
}

func (l textLogger) Log(keyvals ...interface{}) error {
	for i, val := range keyvals {
		switch val.(type) {
		case nil, string, []byte, encoding.TextMarshaler, error, fmt.Stringer: // supported natively by gokit.
		default:
			switch reflect.TypeOf(val).Kind() {
			case reflect.Array, reflect.Chan, reflect.Func, reflect.Map, reflect.Slice, reflect.Struct:
				keyvals[i] = fmt.Sprintf("%+v", val)
			default:
			}
		}
	}
	ll := gokitlog.NewLogfmtLogger(l.w)
	if err := ll.Log(keyvals...); err != nil {
		return err
	}
	return nil
}
