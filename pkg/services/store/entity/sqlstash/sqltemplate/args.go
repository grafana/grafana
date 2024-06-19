package sqltemplate

import (
	"errors"
	"reflect"
	"strings"
)

// Args errors.
var (
	ErrInvalidArgList = errors.New("invalid arglist")
)

// Args keeps the data that needs to be passed to the engine for execution in
// the right order. Add it to your data types passed to SQLTemplate, either by
// embedding or with a named struct field if its Arg method would clash with
// another struct field.
type Args struct {
	d      interface{ ArgPlaceholder(argNum int) string }
	values []any
}

func NewArgs(d Dialect) *Args {
	return &Args{
		d: d,
	}
}

// Arg can be called from within templates to pass arguments to the SQL driver
// to use in the execution of the query.
func (a *Args) Arg(x any) string {
	a.values = append(a.values, x)

	return a.d.ArgPlaceholder(len(a.values))
}

// ArgList returns a comma separated list of `?` placeholders for each element
// in the provided slice argument, calling Arg for each of them.
// Example struct:
//
//	type sqlMyRequest struct {
//		*sqltemplate.SQLTemplate
//		IDs []int64
//	}
//
// Example usage in a SQL template:
//
//	DELETE FROM {{ .Ident "mytab" }}
//		WHERE id IN ( {{ argList . .IDs }} )
//	;
func (a *Args) ArgList(slice reflect.Value) (string, error) {
	if !slice.IsValid() || slice.Kind() != reflect.Slice {
		return "", ErrInvalidArgList
	}
	sliceLen := slice.Len()
	if sliceLen == 0 {
		return "", nil
	}

	var b strings.Builder
	b.Grow(3*sliceLen - 2) // the list will be ?, ?, ?
	for i, l := 0, slice.Len(); i < l; i++ {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(a.Arg(slice.Index(i).Interface()))
	}

	return b.String(), nil
}

func (a *Args) Reset() {
	a.values = nil
}

func (a *Args) GetArgs() []any {
	return a.values
}

type ArgsIface interface {
	Arg(x any) string
	ArgList(slice reflect.Value) (string, error)
	GetArgs() []any
	Reset()
}
