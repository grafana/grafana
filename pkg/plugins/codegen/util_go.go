package codegen

import (
	"bytes"
	"fmt"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"

	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
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
