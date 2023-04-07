package codegen

import (
	"bytes"
	"fmt"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing/fstest"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/dave/dst"
	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/kindsys"
	"golang.org/x/tools/imports"
)

type genGoFile struct {
	path   string
	walker dstutil.ApplyFunc
	in     []byte
}

func postprocessGoFile(cfg genGoFile) ([]byte, error) {
	fname := filepath.Base(cfg.path)
	buf := new(bytes.Buffer)
	fset := token.NewFileSet()
	gf, err := decorator.ParseFile(fset, fname, string(cfg.in), parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("error parsing generated file: %w", err)
	}

	if cfg.walker != nil {
		dstutil.Apply(gf, cfg.walker, nil)

		err = format.Node(buf, fset, gf)
		if err != nil {
			return nil, fmt.Errorf("error formatting Go AST: %w", err)
		}
	} else {
		buf = bytes.NewBuffer(cfg.in)
	}

	byt, err := imports.Process(fname, buf.Bytes(), nil)
	if err != nil {
		return nil, fmt.Errorf("goimports processing failed: %w", err)
	}

	// Compare imports before and after; warn about performance if some were added
	gfa, _ := parser.ParseFile(fset, fname, string(byt), parser.ParseComments)
	imap := make(map[string]bool)
	for _, im := range gf.Imports {
		imap[im.Path.Value] = true
	}
	var added []string
	for _, im := range gfa.Imports {
		if !imap[im.Path.Value] {
			added = append(added, im.Path.Value)
		}
	}

	if len(added) != 0 {
		// TODO improve the guidance in this error if/when we better abstract over imports to generate
		fmt.Fprintf(os.Stderr, "The following imports were added by goimports while generating %s: \n\t%s\nRelying on goimports to find imports significantly slows down code generation. Consider adding these to the relevant template.\n", cfg.path, strings.Join(added, "\n\t"))
	}

	return byt, nil
}

type prefixmod struct {
	prefix  string
	replace string
	rxp     *regexp.Regexp
	rxpsuff *regexp.Regexp
}

// PrefixDropper returns a dstutil.ApplyFunc that removes the provided prefix
// string when it appears as a leading sequence in type names, var names, and
// comments in a generated Go file.
func PrefixDropper(prefix string) dstutil.ApplyFunc {
	return (&prefixmod{
		prefix:  prefix,
		rxpsuff: regexp.MustCompile(fmt.Sprintf(`%s([a-zA-Z_]+)`, prefix)),
		rxp:     regexp.MustCompile(fmt.Sprintf(`%s([\s.,;-])`, prefix)),
	}).applyfunc
}

// PrefixReplacer returns a dstutil.ApplyFunc that removes the provided prefix
// string when it appears as a leading sequence in type names, var names, and
// comments in a generated Go file.
//
// When an exact match for prefix is found, the provided replace string
// is substituted.
func PrefixReplacer(prefix, replace string) dstutil.ApplyFunc {
	return (&prefixmod{
		prefix:  prefix,
		replace: replace,
		rxpsuff: regexp.MustCompile(fmt.Sprintf(`%s([a-zA-Z_]+)`, prefix)),
		rxp:     regexp.MustCompile(fmt.Sprintf(`%s([\s.,;-])`, prefix)),
	}).applyfunc
}

func depoint(e dst.Expr) dst.Expr {
	if star, is := e.(*dst.StarExpr); is {
		return star.X
	}
	return e
}

func (d prefixmod) applyfunc(c *dstutil.Cursor) bool {
	n := c.Node()

	switch x := n.(type) {
	case *dst.ValueSpec:
		d.handleExpr(x.Type)
		for _, id := range x.Names {
			d.do(id)
		}
	case *dst.TypeSpec:
		// Always do typespecs
		d.do(x.Name)
	case *dst.Field:
		// Don't rename struct fields. We just want to rename type declarations, and
		// field value specifications that reference those types.
		d.handleExpr(x.Type)
	case *dst.File:
		for _, def := range x.Decls {
			comments := def.Decorations().Start.All()
			def.Decorations().Start.Clear()
			// For any reason, sometimes it retrieves the comment duplicated 🤷
			commentMap := make(map[string]bool)
			for _, c := range comments {
				if _, ok := commentMap[c]; !ok {
					commentMap[c] = true
					def.Decorations().Start.Append(d.rxpsuff.ReplaceAllString(c, "$1"))
					if d.replace != "" {
						def.Decorations().Start.Append(d.rxp.ReplaceAllString(c, d.replace+"$1"))
					}
				}
			}
		}
	}
	return true
}

func (d prefixmod) handleExpr(e dst.Expr) {
	// Deref a StarExpr, if there is one
	expr := depoint(e)
	switch x := expr.(type) {
	case *dst.Ident:
		d.do(x)
	case *dst.ArrayType:
		if id, is := depoint(x.Elt).(*dst.Ident); is {
			d.do(id)
		}
	case *dst.MapType:
		if id, is := depoint(x.Key).(*dst.Ident); is {
			d.do(id)
		}
		if id, is := depoint(x.Value).(*dst.Ident); is {
			d.do(id)
		}
	}
}

func (d prefixmod) do(n *dst.Ident) {
	if n.Name != d.prefix {
		n.Name = strings.TrimPrefix(n.Name, d.prefix)
	} else if d.replace != "" {
		n.Name = d.replace
	}
}

// GetPublishedKind retrieve the latest published kind from the schema registry
func GetPublishedKind(name string, regPath string, kindPath string) (kindsys.Kind, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("error retrieving working directory: %w", err)
	}

	groot := filepath.Dir(wd)
	path := filepath.Join(groot, regPath)

	latestDir, err := findLatestDir(path)
	if err != nil {
		return nil, err
	}

	if latestDir == "" {
		return nil, nil
	}

	bytes, err := os.ReadFile(filepath.Join(path, latestDir, kindPath, name+".cue"))
	if err != nil {
		return nil, err
	}

	return loadKindFromBytes(name, bytes)
}

func findLatestDir(path string) (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	if _, err := os.Stat(path); err != nil {
		return "", nil
	}

	files, err := os.ReadDir(path)
	if err != nil {
		return "", err
	}

	for _, file := range files {
		if !file.IsDir() {
			continue
		}

		parts := re.FindStringSubmatch(file.Name())
		if parts == nil || len(parts) < 4 {
			continue
		}

		version := make([]uint64, len(parts)-1)
		for i := 1; i < len(parts); i++ {
			version[i-1], _ = strconv.ParseUint(parts[i], 10, 32)
		}

		if isLess(latestVersion, version) {
			latestVersion = version
			latestDir = file.Name()
		}
	}

	return latestDir, nil
}

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

func loadKindFromBytes(name string, kind []byte) (kindsys.Kind, error) {
	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: kind,
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := cuectx.LoadCoreKindDef(fmt.Sprintf("%s.cue", name), rt.Context(), fs)
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindCore(rt, def)
}

// KindToBytes converts a kind cue value to a .cue file content
func KindToBytes(kind cue.Value) ([]byte, error) {
	node := kind.Syntax(
		cue.All(),
		cue.Raw(),
		cue.Schema(),
		cue.Definitions(true),
		cue.Docs(true),
		cue.Hidden(true),
	)

	return cueformat.Node(node)
}
