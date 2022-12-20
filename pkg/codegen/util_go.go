package codegen

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dave/dst"
	"github.com/dave/dst/dstutil"
	"golang.org/x/tools/go/ast/astutil"
	"golang.org/x/tools/imports"
)

type genGoFile struct {
	path   string
	walker astutil.ApplyFunc
	in     []byte
}

func postprocessGoFile(cfg genGoFile) ([]byte, error) {
	fname := filepath.Base(cfg.path)
	buf := new(bytes.Buffer)
	fset := token.NewFileSet()
	gf, err := parser.ParseFile(fset, fname, string(cfg.in), parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("error parsing generated file: %w", err)
	}

	if cfg.walker != nil {
		astutil.Apply(gf, cfg.walker, nil)

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

// PrefixDropper returns an astutil.ApplyFunc that removes the provided prefix
// string when it appears as a leading sequence in type names, var names, and
// comments in a generated Go file.
func PrefixDropper(prefix string) astutil.ApplyFunc {
	return (&prefixmod{
		prefix:  prefix,
		rxpsuff: regexp.MustCompile(fmt.Sprintf(`%s([a-zA-Z_]+)`, prefix)),
		rxp:     regexp.MustCompile(fmt.Sprintf(`%s([\s.,;-])`, prefix)),
	}).applyfunc
}

// PrefixReplacer returns an astutil.ApplyFunc that removes the provided prefix
// string when it appears as a leading sequence in type names, var names, and
// comments in a generated Go file.
//
// When an exact match for prefix is found, the provided replace string
// is substituted.
func PrefixReplacer(prefix, replace string) astutil.ApplyFunc {
	return (&prefixmod{
		prefix:  prefix,
		replace: replace,
		rxpsuff: regexp.MustCompile(fmt.Sprintf(`%s([a-zA-Z_]+)`, prefix)),
		rxp:     regexp.MustCompile(fmt.Sprintf(`%s([\s.,;-])`, prefix)),
	}).applyfunc
}

func depoint(e ast.Expr) ast.Expr {
	if star, is := e.(*ast.StarExpr); is {
		return star.X
	}
	return e
}

func (d prefixmod) applyfunc(c *astutil.Cursor) bool {
	n := c.Node()

	switch x := n.(type) {
	case *ast.ValueSpec:
		d.handleExpr(x.Type)
		for _, id := range x.Names {
			d.do(id)
		}
	case *ast.TypeSpec:
		// Always do typespecs
		d.do(x.Name)
	case *ast.Field:
		// Don't rename struct fields. We just want to rename type declarations, and
		// field value specifications that reference those types.
		d.handleExpr(x.Type)

	case *ast.CommentGroup:
		for _, c := range x.List {
			c.Text = d.rxpsuff.ReplaceAllString(c.Text, "$1")
			if d.replace != "" {
				c.Text = d.rxp.ReplaceAllString(c.Text, d.replace+"$1")
			}
		}
	}
	return true
}

func (d prefixmod) handleExpr(e ast.Expr) {
	// Deref a StarExpr, if there is one
	expr := depoint(e)
	switch x := expr.(type) {
	case *ast.Ident:
		d.do(x)
	case *ast.ArrayType:
		if id, is := depoint(x.Elt).(*ast.Ident); is {
			d.do(id)
		}
	case *ast.MapType:
		if id, is := depoint(x.Key).(*ast.Ident); is {
			d.do(id)
		}
		if id, is := depoint(x.Value).(*ast.Ident); is {
			d.do(id)
		}
	}
}

func (d prefixmod) do(n *ast.Ident) {
	if n.Name != d.prefix {
		n.Name = strings.TrimPrefix(n.Name, d.prefix)
	} else if d.replace != "" {
		n.Name = d.replace
	}
}

func isSingleTypeDecl(gd *dst.GenDecl) bool {
	if gd.Tok == token.TYPE && len(gd.Specs) == 1 {
		_, is := gd.Specs[0].(*dst.TypeSpec)
		return is
	}
	return false
}

func isAdditionalPropertiesStruct(tspec *dst.TypeSpec) (dst.Expr, bool) {
	strct, is := tspec.Type.(*dst.StructType)
	if is && len(strct.Fields.List) == 1 && strct.Fields.List[0].Names[0].Name == "AdditionalProperties" {
		return strct.Fields.List[0].Type, true
	}
	return nil, false
}

func DecoderCompactor() dstutil.ApplyFunc {
	return func(c *dstutil.Cursor) bool {
		f, is := c.Node().(*dst.File)
		if !is {
			return false
		}

		compact := make(map[string]bool)
		// walk the file decls
		for _, decl := range f.Decls {
			if fd, is := decl.(*dst.FuncDecl); is {
				compact[ddepoint(fd.Recv.List[0].Type).(*dst.Ident).Name] = true
			}
		}
		if len(compact) == 0 {
			return false
		}

		replace := make(map[string]dst.Expr)
		// Walk again, looking for types we found
		for _, decl := range f.Decls {
			if gd, is := decl.(*dst.GenDecl); is && isSingleTypeDecl(gd) {
				if tspec := gd.Specs[0].(*dst.TypeSpec); compact[tspec.Name.Name] {
					if expr, is := isAdditionalPropertiesStruct(tspec); is {
						replace[tspec.Name.Name] = expr
					}
				}
			}
		}
		dstutil.Apply(f, func(c *dstutil.Cursor) bool {
			switch x := c.Node().(type) {
			case *dst.FuncDecl:
				c.Delete()
			case *dst.GenDecl:
				if isSingleTypeDecl(x) && compact[x.Specs[0].(*dst.TypeSpec).Name.Name] {
					c.Delete()
				}
			case *dst.Field:
				if id, is := x.Type.(*dst.Ident); is {
					if expr, has := replace[id.Name]; has {
						x.Type = expr
					}
				}
			}
			return true
		}, nil)
		return false
	}
}
func ddepoint(e dst.Expr) dst.Expr {
	if star, is := e.(*dst.StarExpr); is {
		return star.X
	}
	return e
}

