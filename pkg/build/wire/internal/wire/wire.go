// Copyright 2018 The Wire Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package wire provides compile-time dependency injection logic as a
// Go library.
package wire

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/printer"
	"go/token"
	"go/types"
	"io/ioutil"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/tools/go/ast/astutil"
	"golang.org/x/tools/go/packages"
)

// GenerateResult stores the result for a package from a call to Generate.
type GenerateResult struct {
	// PkgPath is the package's PkgPath.
	PkgPath string
	// OutputPath is the path where the generated output should be written.
	// May be empty if there were errors.
	OutputPath string
	// Content is the gofmt'd source code that was generated. May be nil if
	// there were errors during generation.
	Content []byte
	// Errs is a slice of errors identified during generation.
	Errs []error
}

// Commit writes the generated file to disk.
func (gen GenerateResult) Commit() error {
	if len(gen.Content) == 0 {
		return nil
	}
	return ioutil.WriteFile(gen.OutputPath, gen.Content, 0666)
}

// GenerateOptions holds options for Generate.
type GenerateOptions struct {
	// Header will be inserted at the start of each generated file.
	Header           []byte
	PrefixOutputFile string
	Tags             string
	GenTags          string
}

// Generate performs dependency injection for the packages that match the given
// patterns, return a GenerateResult for each package. The package pattern is
// defined by the underlying build system. For the go tool, this is described at
// https://golang.org/cmd/go/#hdr-Package_lists_and_patterns
//
// wd is the working directory and env is the set of environment
// variables to use when loading the package specified by pkgPattern. If
// env is nil or empty, it is interpreted as an empty set of variables.
// In case of duplicate environment variables, the last one in the list
// takes precedence.
//
// Generate may return one or more errors if it failed to load the packages.
func Generate(ctx context.Context, wd string, env []string, patterns []string, opts *GenerateOptions) ([]GenerateResult, []error) {
	if opts == nil {
		opts = &GenerateOptions{}
	}
	pkgs, errs := load(ctx, wd, env, opts.Tags, patterns)
	if len(errs) > 0 {
		return nil, errs
	}
	generated := make([]GenerateResult, len(pkgs))
	for i, pkg := range pkgs {
		generated[i].PkgPath = pkg.PkgPath
		outDir, err := detectOutputDir(pkg.GoFiles)
		if err != nil {
			generated[i].Errs = append(generated[i].Errs, err)
			continue
		}
		generated[i].OutputPath = filepath.Join(outDir, opts.PrefixOutputFile+"wire_gen.go")
		g := newGen(pkg)
		injectorFiles, errs := generateInjectors(g, pkg)
		if len(errs) > 0 {
			generated[i].Errs = errs
			continue
		}
		copyNonInjectorDecls(g, injectorFiles, pkg.TypesInfo)
		goSrc := g.frame(opts.Tags, opts.GenTags)
		if len(opts.Header) > 0 {
			goSrc = append(opts.Header, goSrc...)
		}
		fmtSrc, err := format.Source(goSrc)
		if err != nil {
			// This is likely a bug from a poorly generated source file.
			// Add an error but also the unformatted source.
			generated[i].Errs = append(generated[i].Errs, err)
		} else {
			goSrc = fmtSrc
		}
		generated[i].Content = goSrc
	}
	return generated, nil
}

func detectOutputDir(paths []string) (string, error) {
	if len(paths) == 0 {
		return "", errors.New("no files to derive output directory from")
	}
	dir := filepath.Dir(paths[0])
	for _, p := range paths[1:] {
		if dir2 := filepath.Dir(p); dir2 != dir {
			return "", fmt.Errorf("found conflicting directories %q and %q", dir, dir2)
		}
	}
	return dir, nil
}

// generateInjectors generates the injectors for a given package.
func generateInjectors(g *gen, pkg *packages.Package) (injectorFiles []*ast.File, _ []error) {
	oc := newObjectCache([]*packages.Package{pkg})
	injectorFiles = make([]*ast.File, 0, len(pkg.Syntax))
	ec := new(errorCollector)
	for _, f := range pkg.Syntax {
		for _, decl := range f.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok {
				continue
			}
			buildCall, err := findInjectorBuild(pkg.TypesInfo, fn)
			if err != nil {
				ec.add(err)
				continue
			}
			if buildCall == nil {
				continue
			}
			if len(injectorFiles) == 0 || injectorFiles[len(injectorFiles)-1] != f {
				// This is the first injector generated for this file.
				// Write a file header.
				name := filepath.Base(g.pkg.Fset.File(f.Pos()).Name())
				g.p("// Injectors from %s:\n\n", name)
				injectorFiles = append(injectorFiles, f)
			}
			sig := pkg.TypesInfo.ObjectOf(fn.Name).Type().(*types.Signature)
			ins, _, err := injectorFuncSignature(sig)
			if err != nil {
				if w, ok := err.(*wireErr); ok {
					ec.add(notePosition(w.position, fmt.Errorf("inject %s: %v", fn.Name.Name, w.error)))
				} else {
					ec.add(notePosition(g.pkg.Fset.Position(fn.Pos()), fmt.Errorf("inject %s: %v", fn.Name.Name, err)))
				}
				continue
			}
			injectorArgs := &InjectorArgs{
				Name:  fn.Name.Name,
				Tuple: ins,
				Pos:   fn.Pos(),
			}
			set, errs := oc.processNewSet(pkg.TypesInfo, pkg.PkgPath, buildCall, injectorArgs, "")
			if len(errs) > 0 {
				ec.add(notePositionAll(g.pkg.Fset.Position(fn.Pos()), errs)...)
				continue
			}
			if errs := g.inject(fn.Pos(), fn.Name.Name, sig, set, fn.Doc); len(errs) > 0 {
				ec.add(errs...)
				continue
			}
		}

		for _, impt := range f.Imports {
			if impt.Name != nil && impt.Name.Name == "_" {
				g.anonImports[impt.Path.Value] = true
			}
		}
	}
	if len(ec.errors) > 0 {
		return nil, ec.errors
	}
	return injectorFiles, nil
}

// copyNonInjectorDecls copies any non-injector declarations from the
// given files into the generated output.
func copyNonInjectorDecls(g *gen, files []*ast.File, info *types.Info) {
	for _, f := range files {
		name := filepath.Base(g.pkg.Fset.File(f.Pos()).Name())
		first := true
		for _, decl := range f.Decls {
			switch decl := decl.(type) {
			case *ast.FuncDecl:
				// OK to ignore error, as any error cases should already have
				// been filtered out.
				if buildCall, _ := findInjectorBuild(info, decl); buildCall != nil {
					continue
				}
			case *ast.GenDecl:
				if decl.Tok == token.IMPORT {
					continue
				}
			default:
				continue
			}
			if first {
				g.p("// %s:\n\n", name)
				first = false
			}
			// TODO(light): Add line number at top of each declaration.
			g.writeAST(info, decl)
			g.p("\n\n")
		}
	}
}

// importInfo holds info about an import.
type importInfo struct {
	// name is the identifier that is used in the generated source.
	name string
	// differs is true if the import is given an identifier that does not
	// match the package's identifier.
	differs bool
}

// gen is the file-wide generator state.
type gen struct {
	pkg         *packages.Package
	buf         bytes.Buffer
	imports     map[string]importInfo
	anonImports map[string]bool
	values      map[ast.Expr]string
}

func newGen(pkg *packages.Package) *gen {
	return &gen{
		pkg:         pkg,
		anonImports: make(map[string]bool),
		imports:     make(map[string]importInfo),
		values:      make(map[ast.Expr]string),
	}
}

// frame bakes the built up source body into an unformatted Go source file.
func (g *gen) frame(tags, genTags string) []byte {
	if g.buf.Len() == 0 {
		return nil
	}
	var buf bytes.Buffer
	if len(tags) > 0 {
		tags = fmt.Sprintf(" gen -tags \"%s\"", tags)
	}
	buf.WriteString("// Code generated by Wire. DO NOT EDIT.\n\n")
	buf.WriteString("//go:generate go run ./pkg/build/wire/cmd/wire/main.go" + tags + "\n")
	buildTags := "!wireinject"
	if len(genTags) > 0 {
		buildTags += " && " + genTags
	}
	buf.WriteString("//go:build " + buildTags + "\n\n")
	buf.WriteString("package ")
	buf.WriteString(g.pkg.Name)
	buf.WriteString("\n\n")
	if len(g.imports) > 0 {
		buf.WriteString("import (\n")
		imps := make([]string, 0, len(g.imports))
		for path := range g.imports {
			imps = append(imps, path)
		}
		sort.Strings(imps)
		for _, path := range imps {
			// Omit the local package identifier if it matches the package name.
			info := g.imports[path]
			if info.differs {
				fmt.Fprintf(&buf, "\t%s %q\n", info.name, path)
			} else {
				fmt.Fprintf(&buf, "\t%q\n", path)
			}
		}
		buf.WriteString(")\n\n")
	}
	if len(g.anonImports) > 0 {
		buf.WriteString("import (\n")
		anonImps := make([]string, 0, len(g.anonImports))
		for path := range g.anonImports {
			anonImps = append(anonImps, path)
		}
		sort.Strings(anonImps)

		for _, path := range anonImps {
			fmt.Fprintf(&buf, "\t_ %s\n", path)
		}
		buf.WriteString(")\n\n")
	}
	buf.Write(g.buf.Bytes())
	return buf.Bytes()
}

// inject emits the code for an injector.
func (g *gen) inject(pos token.Pos, name string, sig *types.Signature, set *ProviderSet, doc *ast.CommentGroup) []error {
	injectSig, err := funcOutput(sig)
	if err != nil {
		return []error{notePosition(g.pkg.Fset.Position(pos),
			fmt.Errorf("inject %s: %v", name, err))}
	}
	params := sig.Params()
	calls, errs := solve(g.pkg.Fset, injectSig.out, params, set)
	if len(errs) > 0 {
		return mapErrors(errs, func(e error) error {
			if w, ok := e.(*wireErr); ok {
				return notePosition(w.position, fmt.Errorf("inject %s: %v", name, w.error))
			}
			return notePosition(g.pkg.Fset.Position(pos), fmt.Errorf("inject %s: %v", name, e))
		})
	}
	type pendingVar struct {
		name     string
		expr     ast.Expr
		typeInfo *types.Info
	}
	var pendingVars []pendingVar
	ec := new(errorCollector)
	for i := range calls {
		c := &calls[i]
		if c.hasCleanup && !injectSig.cleanup {
			ts := types.TypeString(c.out, nil)
			ec.add(notePosition(
				g.pkg.Fset.Position(pos),
				fmt.Errorf("inject %s: provider for %s returns cleanup but injection does not return cleanup function", name, ts)))
		}
		if c.hasErr && !injectSig.err {
			ts := types.TypeString(c.out, nil)
			ec.add(notePosition(
				g.pkg.Fset.Position(pos),
				fmt.Errorf("inject %s: provider for %s returns error but injection not allowed to fail", name, ts)))
		}
		if c.kind == valueExpr {
			if err := accessibleFrom(c.valueTypeInfo, c.valueExpr, g.pkg.PkgPath); err != nil {
				// TODO(light): Display line number of value expression.
				ts := types.TypeString(c.out, nil)
				ec.add(notePosition(
					g.pkg.Fset.Position(pos),
					fmt.Errorf("inject %s: value %s can't be used: %v", name, ts, err)))
			}
			if g.values[c.valueExpr] == "" {
				t := c.valueTypeInfo.TypeOf(c.valueExpr)

				name := typeVariableName(t, "", func(name string) string { return "_wire" + export(name) + "Value" }, g.nameInFileScope)
				g.values[c.valueExpr] = name
				pendingVars = append(pendingVars, pendingVar{
					name:     name,
					expr:     c.valueExpr,
					typeInfo: c.valueTypeInfo,
				})
			}
		}
	}
	if len(ec.errors) > 0 {
		return ec.errors
	}

	// Perform one pass to collect all imports, followed by the real pass.
	injectPass(name, sig, calls, set, doc, &injectorGen{
		g:       g,
		errVar:  disambiguate("err", g.nameInFileScope),
		discard: true,
	})
	injectPass(name, sig, calls, set, doc, &injectorGen{
		g:       g,
		errVar:  disambiguate("err", g.nameInFileScope),
		discard: false,
	})
	if len(pendingVars) > 0 {
		g.p("var (\n")
		for _, pv := range pendingVars {
			g.p("\t%s = ", pv.name)
			g.writeAST(pv.typeInfo, pv.expr)
			g.p("\n")
		}
		g.p(")\n\n")
	}
	return nil
}

// rewritePkgRefs rewrites any package references in an AST into references for the
// generated package.
func (g *gen) rewritePkgRefs(info *types.Info, node ast.Node) ast.Node {
	start, end := node.Pos(), node.End()
	node = copyAST(node)
	// First, rewrite all package names. This lets us know all the
	// potentially colliding identifiers.
	node = astutil.Apply(node, func(c *astutil.Cursor) bool {
		switch node := c.Node().(type) {
		case *ast.Ident:
			// This is an unqualified identifier (qualified identifiers are peeled off below).
			obj := info.ObjectOf(node)
			if obj == nil {
				return false
			}
			if pkg := obj.Pkg(); pkg != nil && obj.Parent() == pkg.Scope() && pkg.Path() != g.pkg.PkgPath {
				// An identifier from either a dot import or read from a different package.
				newPkgID := g.qualifyImport(pkg.Name(), pkg.Path())
				c.Replace(&ast.SelectorExpr{
					X:   ast.NewIdent(newPkgID),
					Sel: ast.NewIdent(node.Name),
				})
				return false
			}
			return true
		case *ast.SelectorExpr:
			pkgIdent, ok := node.X.(*ast.Ident)
			if !ok {
				return true
			}
			pkgName, ok := info.ObjectOf(pkgIdent).(*types.PkgName)
			if !ok {
				return true
			}
			// This is a qualified identifier. Rewrite and avoid visiting subexpressions.
			imported := pkgName.Imported()
			newPkgID := g.qualifyImport(imported.Name(), imported.Path())
			c.Replace(&ast.SelectorExpr{
				X:   ast.NewIdent(newPkgID),
				Sel: ast.NewIdent(node.Sel.Name),
			})
			return false
		default:
			return true
		}
	}, nil)
	// Now that we have all the identifiers, rename any variables declared
	// in this scope to not collide.
	newNames := make(map[types.Object]string)
	inNewNames := func(n string) bool {
		for _, other := range newNames {
			if other == n {
				return true
			}
		}
		return false
	}
	var scopeStack []*types.Scope
	pkgScope := g.pkg.Types.Scope()
	node = astutil.Apply(node, func(c *astutil.Cursor) bool {
		if scope := info.Scopes[c.Node()]; scope != nil {
			scopeStack = append(scopeStack, scope)
		}
		id, ok := c.Node().(*ast.Ident)
		if !ok {
			return true
		}
		obj := info.ObjectOf(id)
		if obj == nil {
			// We rewrote this identifier earlier, so it does not need
			// further rewriting.
			return true
		}
		if n, ok := newNames[obj]; ok {
			// We picked a new name for this symbol. Rewrite it.
			c.Replace(ast.NewIdent(n))
			return false
		}
		if par := obj.Parent(); par == nil || par == pkgScope {
			// Don't rename methods, field names, or top-level identifiers.
			return true
		}

		// Rename any symbols defined within rewritePkgRefs's node that conflict
		// with any symbols in the generated file.
		objName := obj.Name()
		if pos := obj.Pos(); pos < start || end <= pos || !(g.nameInFileScope(objName) || inNewNames(objName)) {
			return true
		}
		newName := disambiguate(objName, func(n string) bool {
			if g.nameInFileScope(n) || inNewNames(n) {
				return true
			}
			if len(scopeStack) > 0 {
				// Avoid picking a name that conflicts with other names in the
				// current scope.
				_, obj := scopeStack[len(scopeStack)-1].LookupParent(n, token.NoPos)
				if obj != nil {
					return true
				}
			}
			return false
		})
		newNames[obj] = newName
		c.Replace(ast.NewIdent(newName))
		return false
	}, func(c *astutil.Cursor) bool {
		if info.Scopes[c.Node()] != nil {
			// Should be top of stack; pop it.
			scopeStack = scopeStack[:len(scopeStack)-1]
		}
		return true
	})
	return node
}

// writeAST prints an AST node into the generated output, rewriting any
// package references it encounters.
func (g *gen) writeAST(info *types.Info, node ast.Node) {
	node = g.rewritePkgRefs(info, node)
	if err := printer.Fprint(&g.buf, g.pkg.Fset, node); err != nil {
		panic(err)
	}
}

func (g *gen) qualifiedID(pkgName, pkgPath, sym string) string {
	name := g.qualifyImport(pkgName, pkgPath)
	if name == "" {
		return sym
	}
	return name + "." + sym
}

func (g *gen) qualifyImport(name, path string) string {
	if path == g.pkg.PkgPath {
		return ""
	}
	// TODO(light): This is depending on details of the current loader.
	const vendorPart = "vendor/"
	unvendored := path
	if i := strings.LastIndex(path, vendorPart); i != -1 && (i == 0 || path[i-1] == '/') {
		unvendored = path[i+len(vendorPart):]
	}
	if info, ok := g.imports[unvendored]; ok {
		return info.name
	}
	// TODO(light): Use parts of import path to disambiguate.
	newName := disambiguate(name, func(n string) bool {
		// Don't let an import take the "err" name. That's annoying.
		return n == "err" || g.nameInFileScope(n)
	})
	g.imports[unvendored] = importInfo{
		name:    newName,
		differs: newName != name,
	}
	return newName
}

func (g *gen) nameInFileScope(name string) bool {
	for _, other := range g.imports {
		if other.name == name {
			return true
		}
	}
	for _, other := range g.values {
		if other == name {
			return true
		}
	}
	_, obj := g.pkg.Types.Scope().LookupParent(name, token.NoPos)
	return obj != nil
}

func (g *gen) qualifyPkg(pkg *types.Package) string {
	return g.qualifyImport(pkg.Name(), pkg.Path())
}

func (g *gen) p(format string, args ...interface{}) {
	fmt.Fprintf(&g.buf, format, args...)
}

// injectorGen is the per-injector pass generator state.
type injectorGen struct {
	g *gen

	paramNames   []string
	localNames   []string
	cleanupNames []string
	errVar       string

	// discard causes ig.p and ig.writeAST to no-op. Useful to run
	// generation for side-effects like filling in g.imports.
	discard bool
}

// injectPass generates an injector given the output from analysis.
// The sig passed in should be verified.
func injectPass(name string, sig *types.Signature, calls []call, set *ProviderSet, doc *ast.CommentGroup, ig *injectorGen) {
	params := sig.Params()
	injectSig, err := funcOutput(sig)
	if err != nil {
		// This should be checked by the caller already.
		panic(err)
	}
	if doc != nil {
		for _, c := range doc.List {
			ig.p("%s\n", c.Text)
		}
	}
	ig.p("func %s(", name)
	for i := 0; i < params.Len(); i++ {
		if i > 0 {
			ig.p(", ")
		}
		pi := params.At(i)
		a := pi.Name()
		if a == "" || a == "_" {
			a = typeVariableName(pi.Type(), "arg", unexport, ig.nameInInjector)
		} else {
			a = disambiguate(a, ig.nameInInjector)
		}
		ig.paramNames = append(ig.paramNames, a)
		if sig.Variadic() && i == params.Len()-1 {
			// Keep the varargs signature instead of a slice for the last argument if the
			// injector is variadic.
			ig.p("%s ...%s", ig.paramNames[i], types.TypeString(pi.Type().(*types.Slice).Elem(), ig.g.qualifyPkg))
		} else {
			ig.p("%s %s", ig.paramNames[i], types.TypeString(pi.Type(), ig.g.qualifyPkg))
		}
	}
	outTypeString := types.TypeString(injectSig.out, ig.g.qualifyPkg)
	switch {
	case injectSig.cleanup && injectSig.err:
		ig.p(") (%s, func(), error) {\n", outTypeString)
	case injectSig.cleanup:
		ig.p(") (%s, func()) {\n", outTypeString)
	case injectSig.err:
		ig.p(") (%s, error) {\n", outTypeString)
	default:
		ig.p(") %s {\n", outTypeString)
	}
	for i := range calls {
		c := &calls[i]
		lname := typeVariableName(c.out, "v", unexport, ig.nameInInjector)
		ig.localNames = append(ig.localNames, lname)
		switch c.kind {
		case structProvider:
			ig.structProviderCall(lname, c)
		case funcProviderCall:
			ig.funcProviderCall(lname, c, injectSig)
		case valueExpr:
			ig.valueExpr(lname, c)
		case selectorExpr:
			ig.fieldExpr(lname, c)
		default:
			panic("unknown kind")
		}
	}
	if len(calls) == 0 {
		ig.p("\treturn %s", ig.paramNames[set.For(injectSig.out).Arg().Index])
	} else {
		ig.p("\treturn %s", ig.localNames[len(calls)-1])
	}
	if injectSig.cleanup {
		ig.p(", func() {\n")
		for i := len(ig.cleanupNames) - 1; i >= 0; i-- {
			ig.p("\t\t%s()\n", ig.cleanupNames[i])
		}
		ig.p("\t}")
	}
	if injectSig.err {
		ig.p(", nil")
	}
	ig.p("\n}\n\n")
}

func (ig *injectorGen) funcProviderCall(lname string, c *call, injectSig outputSignature) {
	ig.p("\t%s", lname)
	prevCleanup := len(ig.cleanupNames)
	if c.hasCleanup {
		cname := disambiguate("cleanup", ig.nameInInjector)
		ig.cleanupNames = append(ig.cleanupNames, cname)
		ig.p(", %s", cname)
	}
	if c.hasErr {
		ig.p(", %s", ig.errVar)
	}
	ig.p(" := ")
	ig.p("%s(", ig.g.qualifiedID(c.pkg.Name(), c.pkg.Path(), c.name))
	for i, a := range c.args {
		if i > 0 {
			ig.p(", ")
		}
		if a < len(ig.paramNames) {
			ig.p("%s", ig.paramNames[a])
		} else {
			ig.p("%s", ig.localNames[a-len(ig.paramNames)])
		}
	}
	if c.varargs {
		ig.p("...")
	}
	ig.p(")\n")
	if c.hasErr {
		ig.p("\tif %s != nil {\n", ig.errVar)
		for i := prevCleanup - 1; i >= 0; i-- {
			ig.p("\t\t%s()\n", ig.cleanupNames[i])
		}
		ig.p("\t\treturn %s", zeroValue(injectSig.out, ig.g.qualifyPkg))
		if injectSig.cleanup {
			ig.p(", nil")
		}
		// TODO(light): Give information about failing provider.
		ig.p(", err\n")
		ig.p("\t}\n")
	}
}

func (ig *injectorGen) structProviderCall(lname string, c *call) {
	ig.p("\t%s", lname)
	ig.p(" := ")
	if _, ok := c.out.(*types.Pointer); ok {
		ig.p("&")
	}
	ig.p("%s{\n", ig.g.qualifiedID(c.pkg.Name(), c.pkg.Path(), c.name))
	for i, a := range c.args {
		ig.p("\t\t%s: ", c.fieldNames[i])
		if a < len(ig.paramNames) {
			ig.p("%s", ig.paramNames[a])
		} else {
			ig.p("%s", ig.localNames[a-len(ig.paramNames)])
		}
		ig.p(",\n")
	}
	ig.p("\t}\n")
}

func (ig *injectorGen) valueExpr(lname string, c *call) {
	ig.p("\t%s := %s\n", lname, ig.g.values[c.valueExpr])
}

func (ig *injectorGen) fieldExpr(lname string, c *call) {
	a := c.args[0]
	ig.p("\t%s := ", lname)
	if c.ptrToField {
		ig.p("&")
	}
	if a < len(ig.paramNames) {
		ig.p("%s.%s\n", ig.paramNames[a], c.name)
	} else {
		ig.p("%s.%s\n", ig.localNames[a-len(ig.paramNames)], c.name)
	}
}

// nameInInjector reports whether name collides with any other identifier
// in the current injector.
func (ig *injectorGen) nameInInjector(name string) bool {
	if name == ig.errVar {
		return true
	}
	for _, a := range ig.paramNames {
		if a == name {
			return true
		}
	}
	for _, l := range ig.localNames {
		if l == name {
			return true
		}
	}
	for _, l := range ig.cleanupNames {
		if l == name {
			return true
		}
	}
	return ig.g.nameInFileScope(name)
}

func (ig *injectorGen) p(format string, args ...interface{}) {
	if ig.discard {
		return
	}
	ig.g.p(format, args...)
}

// zeroValue returns the shortest expression that evaluates to the zero
// value for the given type.
func zeroValue(t types.Type, qf types.Qualifier) string {
	switch u := t.Underlying().(type) {
	case *types.Array, *types.Struct:
		return types.TypeString(t, qf) + "{}"
	case *types.Basic:
		info := u.Info()
		switch {
		case info&types.IsBoolean != 0:
			return "false"
		case info&(types.IsInteger|types.IsFloat|types.IsComplex) != 0:
			return "0"
		case info&types.IsString != 0:
			return `""`
		default:
			panic("unreachable")
		}
	case *types.Chan, *types.Interface, *types.Map, *types.Pointer, *types.Signature, *types.Slice:
		return "nil"
	default:
		panic("unreachable")
	}
}

// typeVariableName invents a disambiguated variable name derived from the type name.
// If no name can be derived from the type, defaultName is used.
// transform is used to transform the derived name(s) (including defaultName);
// commonly used functions include export and unexport.
// collides is used to see if a name is ambiguous. If any one of the derived
// names is unambiguous, it used; otherwise, the first derived name is
// disambiguated using disambiguate().
func typeVariableName(t types.Type, defaultName string, transform func(string) string, collides func(string) bool) string {
	if p, ok := t.(*types.Pointer); ok {
		t = p.Elem()
	}
	var names []string
	switch t := t.(type) {
	case *types.Basic:
		if t.Name() != "" {
			names = append(names, t.Name())
		}
	case *types.Named:
		obj := t.Obj()
		if name := obj.Name(); name != "" {
			names = append(names, name)
		}
		// Provide an alternate name prefixed with the package name if possible.
		// E.g., in case of collisions, we'll use "fooCfg" instead of "cfg2".
		if pkg := obj.Pkg(); pkg != nil && pkg.Name() != "" {
			names = append(names, fmt.Sprintf("%s%s", pkg.Name(), strings.Title(obj.Name())))
		}
	}

	// If we were unable to derive a name, use defaultName.
	if len(names) == 0 {
		names = append(names, defaultName)
	}

	// Transform the name(s).
	for i, name := range names {
		names[i] = transform(name)
	}

	// See if there's an unambiguous name; if so, use it.
	for _, name := range names {
		if !token.Lookup(name).IsKeyword() && !collides(name) {
			return name
		}
	}
	// Otherwise, disambiguate the first name.
	return disambiguate(names[0], collides)
}

// unexport converts a name that is potentially exported to an unexported name.
func unexport(name string) string {
	if name == "" {
		return ""
	}
	r, sz := utf8.DecodeRuneInString(name)
	if !unicode.IsUpper(r) {
		// foo -> foo
		return name
	}
	r2, sz2 := utf8.DecodeRuneInString(name[sz:])
	if !unicode.IsUpper(r2) {
		// Foo -> foo
		return string(unicode.ToLower(r)) + name[sz:]
	}
	// UPPERWord -> upperWord
	sbuf := new(strings.Builder)
	sbuf.WriteRune(unicode.ToLower(r))
	i := sz
	r, sz = r2, sz2
	for unicode.IsUpper(r) && sz > 0 {
		r2, sz2 := utf8.DecodeRuneInString(name[i+sz:])
		if sz2 > 0 && unicode.IsLower(r2) {
			break
		}
		i += sz
		sbuf.WriteRune(unicode.ToLower(r))
		r, sz = r2, sz2
	}
	sbuf.WriteString(name[i:])
	return sbuf.String()
}

// export converts a name that is potentially unexported to an exported name.
func export(name string) string {
	if name == "" {
		return ""
	}
	r, sz := utf8.DecodeRuneInString(name)
	if unicode.IsUpper(r) {
		// Foo -> Foo
		return name
	}
	// fooBar -> FooBar
	sbuf := new(strings.Builder)
	sbuf.WriteRune(unicode.ToUpper(r))
	sbuf.WriteString(name[sz:])
	return sbuf.String()
}

// disambiguate picks a unique name, preferring name if it is already unique.
// It also disambiguates against Go's reserved keywords.
func disambiguate(name string, collides func(string) bool) string {
	if !token.Lookup(name).IsKeyword() && !collides(name) {
		return name
	}
	buf := []byte(name)
	if len(buf) > 0 && buf[len(buf)-1] >= '0' && buf[len(buf)-1] <= '9' {
		buf = append(buf, '_')
	}
	base := len(buf)
	for n := 2; ; n++ {
		buf = strconv.AppendInt(buf[:base], int64(n), 10)
		sbuf := string(buf)
		if !token.Lookup(sbuf).IsKeyword() && !collides(sbuf) {
			return sbuf
		}
	}
}

// accessibleFrom reports whether node can be copied to wantPkg without
// violating Go visibility rules.
func accessibleFrom(info *types.Info, node ast.Node, wantPkg string) error {
	var unexportError error
	ast.Inspect(node, func(node ast.Node) bool {
		if unexportError != nil {
			return false
		}
		ident, ok := node.(*ast.Ident)
		if !ok {
			return true
		}
		obj := info.ObjectOf(ident)
		if _, ok := obj.(*types.PkgName); ok {
			// Local package names are fine, since we can just reimport them.
			return true
		}
		if pkg := obj.Pkg(); pkg != nil {
			if !ast.IsExported(ident.Name) && pkg.Path() != wantPkg {
				unexportError = fmt.Errorf("uses unexported identifier %s", obj.Name())
				return false
			}
			if obj.Parent() != nil && obj.Parent() != pkg.Scope() {
				unexportError = fmt.Errorf("%s is not declared in package scope", obj.Name())
				return false
			}
		}
		return true
	})
	return unexportError
}

var (
	errorType   = types.Universe.Lookup("error").Type()
	cleanupType = types.NewSignature(nil, nil, nil, false)
)
