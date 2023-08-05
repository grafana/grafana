package codegen

import (
	"bytes"
	"go/parser"
	"go/token"
	"testing"

	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
	"github.com/matryer/is"
)

func TestPrefixDropper(t *testing.T) {
	tt := map[string]struct {
		in, out string
		skip    bool
	}{
		"basic": {
			in: `package foo

type Foo struct {
	Id int64
	Ref FooThing
}

type FooThing struct {
	Id int64
}`,
			out: `package foo

type Foo struct {
	Id  int64
	Ref Thing
}

type Thing struct {
	Id int64
}
`,
		},
		"pointer": {
			in: `package foo

type Foo struct {
	Id int64
	Ref *FooThing
}

type FooThing struct {
	Id int64
}`,
			out: `package foo

type Foo struct {
	Id  int64
	Ref *Thing
}

type Thing struct {
	Id int64
}
`,
		},
		"sliceref": {
			in: `package foo

type Foo struct {
	Id int64
	Ref []FooThing
	PRef []*FooThing
	SPRef *[]FooThing
}

type FooThing struct {
	Id int64
}`,
			out: `package foo

type Foo struct {
	Id    int64
	Ref   []Thing
	PRef  []*Thing
	SPRef *[]Thing
}

type Thing struct {
	Id int64
}
`,
		},
		"mapref": {
			in: `package foo

type Foo struct {
	Id int64
	KeyRef map[FooThing]string
	ValRef map[string]FooThing
	BothRef map[FooThing]FooThing
}

type FooThing struct {
	Id int64
}`,
			out: `package foo

type Foo struct {
	Id      int64
	KeyRef  map[Thing]string
	ValRef  map[string]Thing
	BothRef map[Thing]Thing
}

type Thing struct {
	Id int64
}
`,
		},
		"pmapref": {
			in: `package foo

type Foo struct {
	Id int64
	KeyRef map[*FooThing]string
	ValRef map[string]*FooThing
	BothRef map[*FooThing]*FooThing
	PKeyRef *map[*FooThing]string
}

type FooThing struct {
	Id int64
}`,
			out: `package foo

type Foo struct {
	Id      int64
	KeyRef  map[*Thing]string
	ValRef  map[string]*Thing
	BothRef map[*Thing]*Thing
	PKeyRef *map[*Thing]string
}

type Thing struct {
	Id int64
}
`,
		},
		"ignore-fieldname": {
			in: `package foo

type Foo struct {
	Id int64
	FooRef []string
}`,
			out: `package foo

type Foo struct {
	Id     int64
	FooRef []string
}
`,
		},
		"const": {
			in: `package foo

const one FooThing = "boop"

const (
	two   FooThing = "boop"
	three FooThing = "boop"
)

type FooThing string
`,
			out: `package foo

const one Thing = "boop"

const (
	two   Thing = "boop"
	three Thing = "boop"
)

type Thing string
`,
		},
		"var": {
			in: `package foo

var one FooThing = "boop"

var (
	two   FooThing = "boop"
	three FooThing = "boop"
)

type FooThing string
`,
			out: `package foo

var one Thing = "boop"

var (
	two   Thing = "boop"
	three Thing = "boop"
)

type Thing string
`,
		},
		"varp": {
			in: `package foo

var one *FooThing = "boop"

var (
	two   []FooThing = []FooThing{"boop"}
	three map[FooThing]string = map[FooThing]string{ "beep": "boop" }
)

type FooThing string
`,
			out: `package foo

var one *Thing = "boop"

var (
	two   []Thing = []Thing{"boop"}
	three map[Thing]string = map[Thing]string{ "beep": "boop" }
)

type Thing string
`,
			// Skip this one for now - there's currently no codegen that constructs instances
			// of objects, only types, so we shouldn't encounter this case.
			skip: true,
		},
		"comments": {
			in: `package foo

// Foo is a thing. It should be Foo still.
type Foo struct {
	Id int64
	Ref FooThing
}

// FooThing is also a thing. We want [FooThing] to be known properly.
// Even if FooThing
// were not a FooThing, in our minds, forever shall it be FooThing.
type FooThing struct {
	Id int64
}`,
			out: `package foo

// Foo is a thing. It should be Foo still.
type Foo struct {
	Id  int64
	Ref Thing
}

// Thing is also a thing. We want [Thing] to be known properly.
// Even if Thing
// were not a Thing, in our minds, forever shall it be Thing.
type Thing struct {
	Id int64
}
`,
		},
	}

	for name, it := range tt {
		item := it
		t.Run(name, func(t *testing.T) {
			if item.skip {
				t.Skip()
			}
			is := is.New(t)
			fset := token.NewFileSet()
			inf, err := decorator.ParseFile(fset, "input.go", item.in, parser.ParseComments)
			if err != nil {
				t.Fatal(err)
			}

			drop := PrefixDropper("Foo")
			dstutil.Apply(inf, drop, nil)
			buf := new(bytes.Buffer)
			err = decorator.Fprint(buf, inf)
			if err != nil {
				t.Fatal(err)
			}
			is.Equal(item.out, buf.String())
		})
	}
}
