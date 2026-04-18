package commands

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/urfave/cli/v2"
)

func (d Deps) cmdImports() *cli.Command {
	return &cli.Command{
		Name:  "imports",
		Usage: "Help for pkg/extensions/enterprise_imports.go (GE-only Go deps)",
		Subcommands: []*cli.Command{
			{
				Name:  "explain",
				Usage: "Print where enterprise_imports.go lives and the upstream comment guidance",
				Action: func(c *cli.Context) error {
					p, err := d.mustResolve(c)
					if err != nil {
						return err
					}
					path := p.EnterpriseImportsGo()
					_, _ = fmt.Fprintf(c.App.Writer, "File: %s\n\n", path)
					b, err := os.ReadFile(path)
					if err != nil {
						return err
					}
					lines := strings.Split(string(b), "\n")
					for _, ln := range lines {
						if strings.HasPrefix(strings.TrimSpace(ln), "//") {
							_, _ = fmt.Fprintln(c.App.Writer, ln)
							continue
						}
						if strings.HasPrefix(strings.TrimSpace(ln), "package ") {
							break
						}
					}
					_, _ = fmt.Fprintln(c.App.Writer, "\nAdd a blank import for modules used only in enterprise code so they become direct dependencies in go.mod.")
					return nil
				},
			},
			{
				Name:      "add",
				Usage:     "Insert a blank import into enterprise_imports.go (preserves //go:build lines)",
				ArgsUsage: "<import-path>",
				Flags: []cli.Flag{
					&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Confirm writing the file"},
				},
				Action: func(c *cli.Context) error {
					ip := strings.TrimSpace(strings.Trim(c.Args().First(), `"`))
					if ip == "" {
						return fmt.Errorf("import path required")
					}
					if !c.Bool("yes") {
						return fmt.Errorf("refusing without --yes to modify enterprise_imports.go")
					}
					p, err := d.mustResolve(c)
					if err != nil {
						return err
					}
					return addEnterpriseImport(p.OSS, ip)
				},
			},
		},
	}
}

func addEnterpriseImport(ossRoot, importPath string) error {
	path := filepath.Join(ossRoot, "pkg", "extensions", "enterprise_imports.go")
	src, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, src, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	quoted := strconv.Quote(importPath)
	var importGen *ast.GenDecl
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.IMPORT || gen.Lparen == token.NoPos {
			continue
		}
		importGen = gen
		break
	}
	if importGen == nil {
		return fmt.Errorf("no grouped import block in %s", path)
	}
	for _, spec := range importGen.Specs {
		im, ok := spec.(*ast.ImportSpec)
		if !ok || im.Path == nil {
			continue
		}
		if im.Path.Value == quoted {
			return fmt.Errorf("import %q already present", importPath)
		}
	}
	off := fset.Position(importGen.Rparen).Offset
	if off < 0 || off > len(src) {
		return fmt.Errorf("invalid import block end offset in %s", path)
	}
	if src[off] != ')' {
		return fmt.Errorf("internal: expected ')' before grouped import close in %s", path)
	}
	insert := []byte("\t_ " + quoted + "\n")
	out := make([]byte, 0, len(src)+len(insert))
	out = append(out, src[:off]...)
	out = append(out, insert...)
	out = append(out, src[off:]...)
	st, err := os.Stat(path)
	mode := os.FileMode(0o644)
	if err == nil {
		mode = st.Mode()
	}
	return os.WriteFile(path, out, mode)
}
