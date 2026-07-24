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

package wire

import (
	"context"
	"errors"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"os"
	"reflect"
	"strconv"
	"strings"

	"golang.org/x/tools/go/ast/astutil"
	"golang.org/x/tools/go/packages"
	"golang.org/x/tools/go/types/typeutil"
)

// A providerSetSrc captures the source for a type provided by a ProviderSet.
// Exactly one of the fields will be set.
type providerSetSrc struct {
	Provider    *Provider
	Binding     *IfaceBinding
	Value       *Value
	Import      *ProviderSet
	InjectorArg *InjectorArg
	Field       *Field
}

// description returns a string describing the source of p, including line numbers.
func (p *providerSetSrc) description(fset *token.FileSet, typ types.Type) string {
	quoted := func(s string) string {
		if s == "" {
			return ""
		}
		return fmt.Sprintf("%q ", s)
	}
	switch {
	case p.Provider != nil:
		kind := "provider"
		if p.Provider.IsStruct {
			kind = "struct provider"
		}
		return fmt.Sprintf("%s %s(%s)", kind, quoted(p.Provider.Name), fset.Position(p.Provider.Pos))
	case p.Binding != nil:
		return fmt.Sprintf("wire.Bind (%s)", fset.Position(p.Binding.Pos))
	case p.Value != nil:
		return fmt.Sprintf("wire.Value (%s)", fset.Position(p.Value.Pos))
	case p.Import != nil:
		return fmt.Sprintf("provider set %s(%s)", quoted(p.Import.VarName), fset.Position(p.Import.Pos))
	case p.InjectorArg != nil:
		args := p.InjectorArg.Args
		return fmt.Sprintf("argument %s to injector function %s (%s)", args.Tuple.At(p.InjectorArg.Index).Name(), args.Name, fset.Position(args.Pos))
	case p.Field != nil:
		return fmt.Sprintf("wire.FieldsOf (%s)", fset.Position(p.Field.Pos))
	}
	panic("providerSetSrc with no fields set")
}

// trace returns a slice of strings describing the (possibly recursive) source
// of p, including line numbers.
func (p *providerSetSrc) trace(fset *token.FileSet, typ types.Type) []string {
	var retval []string
	// Only Imports need recursion.
	if p.Import != nil {
		if parent := p.Import.srcMap.At(typ); parent != nil {
			retval = append(retval, parent.(*providerSetSrc).trace(fset, typ)...)
		}
	}
	retval = append(retval, p.description(fset, typ))
	return retval
}

// A ProviderSet describes a set of providers.  The zero value is an empty
// ProviderSet.
type ProviderSet struct {
	// Pos is the position of the call to wire.NewSet or wire.Build that
	// created the set.
	Pos token.Pos
	// PkgPath is the import path of the package that declared this set.
	PkgPath string
	// VarName is the variable name of the set, if it came from a package
	// variable.
	VarName string

	Providers []*Provider
	Bindings  []*IfaceBinding
	Values    []*Value
	Fields    []*Field
	Imports   []*ProviderSet
	// InjectorArgs is only filled in for wire.Build.
	InjectorArgs *InjectorArgs

	// providerMap maps from provided type to a *ProvidedType.
	// It includes all of the imported types.
	providerMap *typeutil.Map

	// srcMap maps from provided type to a *providerSetSrc capturing the
	// Provider, Binding, Value, or Import that provided the type.
	srcMap *typeutil.Map
}

// Outputs returns a new slice containing the set of possible types the
// provider set can produce. The order is unspecified.
func (set *ProviderSet) Outputs() []types.Type {
	return set.providerMap.Keys()
}

// For returns a ProvidedType for the given type, or the zero ProvidedType.
func (set *ProviderSet) For(t types.Type) ProvidedType {
	pt := set.providerMap.At(t)
	if pt == nil {
		return ProvidedType{}
	}
	return *pt.(*ProvidedType)
}

// An IfaceBinding declares that a type should be used to satisfy inputs
// of the given interface type.
type IfaceBinding struct {
	// Iface is the interface type, which is what can be injected.
	Iface types.Type

	// Provided is always a type that is assignable to Iface.
	Provided types.Type

	// Pos is the position where the binding was declared.
	Pos token.Pos
}

// Provider records the signature of a provider. A provider is a
// single Go object, either a function or a named struct type.
type Provider struct {
	// Pkg is the package that the Go object resides in.
	Pkg *types.Package

	// Name is the name of the Go object.
	Name string

	// Pos is the source position of the func keyword or type spec
	// defining this provider.
	Pos token.Pos

	// Args is the list of data dependencies this provider has.
	Args []ProviderInput

	// Varargs is true if the provider function is variadic.
	Varargs bool

	// IsStruct is true if this provider is a named struct type.
	// Otherwise it's a function.
	IsStruct bool

	// Out is the set of types this provider produces. It will always
	// contain at least one type.
	Out []types.Type

	// HasCleanup reports whether the provider function returns a cleanup
	// function.  (Always false for structs.)
	HasCleanup bool

	// HasErr reports whether the provider function can return an error.
	// (Always false for structs.)
	HasErr bool
}

// ProviderInput describes an incoming edge in the provider graph.
type ProviderInput struct {
	Type types.Type

	// If the provider is a struct, FieldName will be the field name to set.
	FieldName string
}

// Value describes a value expression.
type Value struct {
	// Pos is the source position of the expression defining this value.
	Pos token.Pos

	// Out is the type this value produces.
	Out types.Type

	// expr is the expression passed to wire.Value.
	expr ast.Expr

	// info is the type info for the expression.
	info *types.Info
}

// InjectorArg describes a specific argument passed to an injector function.
type InjectorArg struct {
	// Args is the full set of arguments.
	Args *InjectorArgs
	// Index is the index into Args.Tuple for this argument.
	Index int
}

// InjectorArgs describes the arguments passed to an injector function.
type InjectorArgs struct {
	// Name is the name of the injector function.
	Name string
	// Tuple represents the arguments.
	Tuple *types.Tuple
	// Pos is the source position of the injector function.
	Pos token.Pos
}

// Field describes a specific field selected from a struct.
type Field struct {
	// Parent is the struct or pointer to the struct that the field belongs to.
	Parent types.Type
	// Name is the field name.
	Name string
	// Pkg is the package that the struct resides in.
	Pkg *types.Package
	// Pos is the source position of the field declaration.
	// defining these fields.
	Pos token.Pos
	// Out is the field's provided types. The first element provides the
	// field type. If the field is coming from a pointer to a struct,
	// there will be a second element providing a pointer to the field.
	Out []types.Type
}

// Load finds all the provider sets in the packages that match the given
// patterns, as well as the provider sets' transitive dependencies. It
// may return both errors and Info. The patterns are defined by the
// underlying build system. For the go tool, this is described at
// https://golang.org/cmd/go/#hdr-Package_lists_and_patterns
//
// wd is the working directory and env is the set of environment
// variables to use when loading the packages specified by patterns. If
// env is nil or empty, it is interpreted as an empty set of variables.
// In case of duplicate environment variables, the last one in the list
// takes precedence.
func Load(ctx context.Context, wd string, env []string, tags string, patterns []string) (*Info, []error) {
	pkgs, errs := load(ctx, wd, env, tags, patterns)
	if len(errs) > 0 {
		return nil, errs
	}
	if len(pkgs) == 0 {
		return new(Info), nil
	}
	fset := pkgs[0].Fset
	info := &Info{
		Fset: fset,
		Sets: make(map[ProviderSetID]*ProviderSet),
	}
	oc := newObjectCache(pkgs)
	ec := new(errorCollector)
	for _, pkg := range pkgs {
		if isWireImport(pkg.PkgPath) {
			// The marker function package confuses analysis.
			continue
		}
		scope := pkg.Types.Scope()
		for _, name := range scope.Names() {
			obj := scope.Lookup(name)
			if !isProviderSetType(obj.Type()) {
				continue
			}
			item, errs := oc.get(obj)
			if len(errs) > 0 {
				ec.add(notePositionAll(fset.Position(obj.Pos()), errs)...)
				continue
			}
			pset := item.(*ProviderSet)
			// pset.Name may not equal name, since it could be an alias to
			// another provider set.
			id := ProviderSetID{ImportPath: pset.PkgPath, VarName: name}
			info.Sets[id] = pset
		}
		for _, f := range pkg.Syntax {
			for _, decl := range f.Decls {
				fn, ok := decl.(*ast.FuncDecl)
				if !ok {
					continue
				}
				buildCall, err := findInjectorBuild(pkg.TypesInfo, fn)
				if err != nil {
					ec.add(notePosition(fset.Position(fn.Pos()), fmt.Errorf("inject %s: %v", fn.Name.Name, err)))
					continue
				}
				if buildCall == nil {
					continue
				}
				sig := pkg.TypesInfo.ObjectOf(fn.Name).Type().(*types.Signature)
				ins, out, err := injectorFuncSignature(sig)
				if err != nil {
					if w, ok := err.(*wireErr); ok {
						ec.add(notePosition(w.position, fmt.Errorf("inject %s: %v", fn.Name.Name, w.error)))
					} else {
						ec.add(notePosition(fset.Position(fn.Pos()), fmt.Errorf("inject %s: %v", fn.Name.Name, err)))
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
					ec.add(notePositionAll(fset.Position(fn.Pos()), errs)...)
					continue
				}
				_, errs = solve(fset, out.out, ins, set)
				if len(errs) > 0 {
					ec.add(mapErrors(errs, func(e error) error {
						if w, ok := e.(*wireErr); ok {
							return notePosition(w.position, fmt.Errorf("inject %s: %v", fn.Name.Name, w.error))
						}
						return notePosition(fset.Position(fn.Pos()), fmt.Errorf("inject %s: %v", fn.Name.Name, e))
					})...)
					continue
				}
				info.Injectors = append(info.Injectors, &Injector{
					ImportPath: pkg.PkgPath,
					FuncName:   fn.Name.Name,
				})
			}
		}
	}
	return info, ec.errors
}

// load typechecks the packages that match the given patterns and
// includes source for all transitive dependencies. The patterns are
// defined by the underlying build system. For the go tool, this is
// described at https://golang.org/cmd/go/#hdr-Package_lists_and_patterns
//
// wd is the working directory and env is the set of environment
// variables to use when loading the packages specified by patterns. If
// env is nil or empty, it is interpreted as an empty set of variables.
// In case of duplicate environment variables, the last one in the list
// takes precedence.
func load(ctx context.Context, wd string, env []string, tags string, patterns []string) ([]*packages.Package, []error) {
	cfg := &packages.Config{
		Context:    ctx,
		Mode:       packages.LoadAllSyntax,
		Dir:        wd,
		Env:        env,
		BuildFlags: []string{"-tags=wireinject"},
		// TODO(light): Use ParseFile to skip function bodies and comments in indirect packages.
	}
	if len(tags) > 0 {
		cfg.BuildFlags[0] += " " + tags
	}
	escaped := make([]string, len(patterns))
	for i := range patterns {
		escaped[i] = "pattern=" + patterns[i]
	}
	pkgs, err := packages.Load(cfg, escaped...)
	if err != nil {
		return nil, []error{err}
	}
	var errs []error
	for _, p := range pkgs {
		for _, e := range p.Errors {
			errs = append(errs, e)
		}
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return pkgs, nil
}

// Info holds the result of Load.
type Info struct {
	Fset *token.FileSet

	// Sets contains all the provider sets in the initial packages.
	Sets map[ProviderSetID]*ProviderSet

	// Injectors contains all the injector functions in the initial packages.
	// The order is undefined.
	Injectors []*Injector
}

// A ProviderSetID identifies a named provider set.
type ProviderSetID struct {
	ImportPath string
	VarName    string
}

// String returns the ID as ""path/to/pkg".Foo".
func (id ProviderSetID) String() string {
	return strconv.Quote(id.ImportPath) + "." + id.VarName
}

// An Injector describes an injector function.
type Injector struct {
	ImportPath string
	FuncName   string
}

// String returns the injector name as ""path/to/pkg".Foo".
func (in *Injector) String() string {
	return strconv.Quote(in.ImportPath) + "." + in.FuncName
}

// objectCache is a lazily evaluated mapping of objects to Wire structures.
type objectCache struct {
	fset     *token.FileSet
	packages map[string]*packages.Package
	objects  map[objRef]objCacheEntry
	hasher   typeutil.Hasher
}

type objRef struct {
	importPath string
	name       string
}

type objCacheEntry struct {
	val  interface{} // *Provider, *ProviderSet, *IfaceBinding, or *Value
	errs []error
}

func newObjectCache(pkgs []*packages.Package) *objectCache {
	if len(pkgs) == 0 {
		panic("object cache must have packages to draw from")
	}
	oc := &objectCache{
		fset:     pkgs[0].Fset,
		packages: make(map[string]*packages.Package),
		objects:  make(map[objRef]objCacheEntry),
		hasher:   typeutil.MakeHasher(),
	}
	// Depth-first search of all dependencies to gather import path to
	// packages.Package mapping. go/packages guarantees that for a single
	// call to packages.Load and an import path X, there will exist only
	// one *packages.Package value with PkgPath X.
	stk := append([]*packages.Package(nil), pkgs...)
	for len(stk) > 0 {
		p := stk[len(stk)-1]
		stk = stk[:len(stk)-1]
		if oc.packages[p.PkgPath] != nil {
			continue
		}
		oc.packages[p.PkgPath] = p
		for _, imp := range p.Imports {
			stk = append(stk, imp)
		}
	}
	return oc
}

// get converts a Go object into a Wire structure. It may return a *Provider, an
// *IfaceBinding, a *ProviderSet, a *Value, or a []*Field.
func (oc *objectCache) get(obj types.Object) (val interface{}, errs []error) {
	ref := objRef{
		importPath: obj.Pkg().Path(),
		name:       obj.Name(),
	}
	if ent, cached := oc.objects[ref]; cached {
		return ent.val, append([]error(nil), ent.errs...)
	}
	defer func() {
		oc.objects[ref] = objCacheEntry{
			val:  val,
			errs: append([]error(nil), errs...),
		}
	}()
	switch obj := obj.(type) {
	case *types.Var:
		spec := oc.varDecl(obj)
		if spec == nil || len(spec.Values) == 0 {
			return nil, []error{fmt.Errorf("%v is not a provider or a provider set", obj)}
		}
		var i int
		for i = range spec.Names {
			if spec.Names[i].Name == obj.Name() {
				break
			}
		}
		pkgPath := obj.Pkg().Path()
		return oc.processExpr(oc.packages[pkgPath].TypesInfo, pkgPath, spec.Values[i], obj.Name())
	case *types.Func:
		return processFuncProvider(oc.fset, obj)
	default:
		return nil, []error{fmt.Errorf("%v is not a provider or a provider set", obj)}
	}
}

// varDecl finds the declaration that defines the given variable.
func (oc *objectCache) varDecl(obj *types.Var) *ast.ValueSpec {
	// TODO(light): Walk files to build object -> declaration mapping, if more performant.
	// Recommended by https://golang.org/s/types-tutorial
	pkg := oc.packages[obj.Pkg().Path()]
	pos := obj.Pos()
	for _, f := range pkg.Syntax {
		tokenFile := oc.fset.File(f.Pos())
		if base := tokenFile.Base(); base <= int(pos) && int(pos) < base+tokenFile.Size() {
			path, _ := astutil.PathEnclosingInterval(f, pos, pos)
			for _, node := range path {
				if spec, ok := node.(*ast.ValueSpec); ok {
					return spec
				}
			}
		}
	}
	return nil
}

// processExpr converts an expression into a Wire structure. It may return a
// *Provider, an *IfaceBinding, a *ProviderSet, a *Value or a []*Field.
func (oc *objectCache) processExpr(info *types.Info, pkgPath string, expr ast.Expr, varName string) (interface{}, []error) {
	exprPos := oc.fset.Position(expr.Pos())
	expr = astutil.Unparen(expr)
	if obj := qualifiedIdentObject(info, expr); obj != nil {
		item, errs := oc.get(obj)
		return item, mapErrors(errs, func(err error) error {
			return notePosition(exprPos, err)
		})
	}
	if call, ok := expr.(*ast.CallExpr); ok {
		fnObj := qualifiedIdentObject(info, call.Fun)
		if fnObj == nil {
			return nil, []error{notePosition(exprPos, errors.New("unknown pattern fnObj nil"))}
		}
		pkg := fnObj.Pkg()
		if pkg == nil {
			return nil, []error{notePosition(exprPos, fmt.Errorf("unknown pattern - pkg in fnObj is nil - %s", fnObj))}
		}
		if !isWireImport(pkg.Path()) {
			return nil, []error{notePosition(exprPos, errors.New("unknown pattern"))}
		}
		switch fnObj.Name() {
		case "NewSet":
			pset, errs := oc.processNewSet(info, pkgPath, call, nil, varName)
			return pset, notePositionAll(exprPos, errs)
		case "Bind":
			b, err := processBind(oc.fset, info, call)
			if err != nil {
				return nil, []error{notePosition(exprPos, err)}
			}
			return b, nil
		case "Value":
			v, err := processValue(oc.fset, info, call)
			if err != nil {
				return nil, []error{notePosition(exprPos, err)}
			}
			return v, nil
		case "InterfaceValue":
			v, err := processInterfaceValue(oc.fset, info, call)
			if err != nil {
				return nil, []error{notePosition(exprPos, err)}
			}
			return v, nil
		case "Struct":
			s, err := processStructProvider(oc.fset, info, call)
			if err != nil {
				return nil, []error{notePosition(exprPos, err)}
			}
			return s, nil
		case "FieldsOf":
			v, err := processFieldsOf(oc.fset, info, call)
			if err != nil {
				return nil, []error{notePosition(exprPos, err)}
			}
			return v, nil
		default:
			return nil, []error{notePosition(exprPos, errors.New("unknown pattern"))}
		}
	}
	if tn := structArgType(info, expr); tn != nil {
		p, errs := processStructLiteralProvider(oc.fset, tn)
		if len(errs) > 0 {
			return nil, notePositionAll(exprPos, errs)
		}
		return p, nil
	}
	return nil, []error{notePosition(exprPos, errors.New("unknown pattern"))}
}

func (oc *objectCache) processNewSet(info *types.Info, pkgPath string, call *ast.CallExpr, args *InjectorArgs, varName string) (*ProviderSet, []error) {
	// Assumes that call.Fun is wire.NewSet or wire.Build.

	pset := &ProviderSet{
		Pos:          call.Pos(),
		InjectorArgs: args,
		PkgPath:      pkgPath,
		VarName:      varName,
	}
	ec := new(errorCollector)
	for _, arg := range call.Args {
		item, errs := oc.processExpr(info, pkgPath, arg, "")
		if len(errs) > 0 {
			ec.add(errs...)
			continue
		}
		switch item := item.(type) {
		case *Provider:
			pset.Providers = append(pset.Providers, item)
		case *ProviderSet:
			pset.Imports = append(pset.Imports, item)
		case *IfaceBinding:
			pset.Bindings = append(pset.Bindings, item)
		case *Value:
			pset.Values = append(pset.Values, item)
		case []*Field:
			pset.Fields = append(pset.Fields, item...)
		default:
			panic("unknown item type")
		}
	}
	if len(ec.errors) > 0 {
		return nil, ec.errors
	}
	var errs []error
	pset.providerMap, pset.srcMap, errs = buildProviderMap(oc.fset, oc.hasher, pset)
	if len(errs) > 0 {
		return nil, errs
	}
	if errs := verifyAcyclic(pset.providerMap, oc.hasher); len(errs) > 0 {
		return nil, errs
	}
	return pset, nil
}

// structArgType attempts to interpret an expression as a simple struct type.
// It assumes any parentheses have been stripped.
func structArgType(info *types.Info, expr ast.Expr) *types.TypeName {
	lit, ok := expr.(*ast.CompositeLit)
	if !ok {
		return nil
	}
	tn, ok := qualifiedIdentObject(info, lit.Type).(*types.TypeName)
	if !ok {
		return nil
	}
	if _, isStruct := tn.Type().Underlying().(*types.Struct); !isStruct {
		return nil
	}
	return tn
}

// qualifiedIdentObject finds the object for an identifier or a
// qualified identifier, or nil if the object could not be found.
func qualifiedIdentObject(info *types.Info, expr ast.Expr) types.Object {
	switch expr := expr.(type) {
	case *ast.Ident:
		return info.ObjectOf(expr)
	case *ast.SelectorExpr:
		pkgName, ok := expr.X.(*ast.Ident)
		if !ok {
			return nil
		}
		if _, ok := info.ObjectOf(pkgName).(*types.PkgName); !ok {
			return nil
		}
		return info.ObjectOf(expr.Sel)
	default:
		return nil
	}
}

// processFuncProvider creates a provider for a function declaration.
func processFuncProvider(fset *token.FileSet, fn *types.Func) (*Provider, []error) {
	sig := fn.Type().(*types.Signature)
	fpos := fn.Pos()
	providerSig, err := funcOutput(sig)
	if err != nil {
		return nil, []error{notePosition(fset.Position(fpos), fmt.Errorf("wrong signature for provider %s: %v", fn.Name(), err))}
	}
	params := sig.Params()
	provider := &Provider{
		Pkg:        fn.Pkg(),
		Name:       fn.Name(),
		Pos:        fn.Pos(),
		Args:       make([]ProviderInput, params.Len()),
		Varargs:    sig.Variadic(),
		Out:        []types.Type{providerSig.out},
		HasCleanup: providerSig.cleanup,
		HasErr:     providerSig.err,
	}
	for i := 0; i < params.Len(); i++ {
		provider.Args[i] = ProviderInput{
			Type: params.At(i).Type(),
		}
		for j := 0; j < i; j++ {
			if types.Identical(provider.Args[i].Type, provider.Args[j].Type) {
				return nil, []error{notePosition(fset.Position(fpos), fmt.Errorf("provider has multiple parameters of type %s", types.TypeString(provider.Args[j].Type, nil)))}
			}
		}
	}
	return provider, nil
}

func injectorFuncSignature(sig *types.Signature) (*types.Tuple, outputSignature, error) {
	out, err := funcOutput(sig)
	if err != nil {
		return nil, outputSignature{}, err
	}
	return sig.Params(), out, nil
}

type outputSignature struct {
	out     types.Type
	cleanup bool
	err     bool
}

// funcOutput validates an injector or provider function's return signature.
func funcOutput(sig *types.Signature) (outputSignature, error) {
	results := sig.Results()
	switch results.Len() {
	case 0:
		return outputSignature{}, errors.New("no return values")
	case 1:
		return outputSignature{out: results.At(0).Type()}, nil
	case 2:
		out := results.At(0).Type()
		switch t := results.At(1).Type(); {
		case types.Identical(t, errorType):
			return outputSignature{out: out, err: true}, nil
		case types.Identical(t, cleanupType):
			return outputSignature{out: out, cleanup: true}, nil
		default:
			return outputSignature{}, fmt.Errorf("second return type is %s; must be error or func()", types.TypeString(t, nil))
		}
	case 3:
		if t := results.At(1).Type(); !types.Identical(t, cleanupType) {
			return outputSignature{}, fmt.Errorf("second return type is %s; must be func()", types.TypeString(t, nil))
		}
		if t := results.At(2).Type(); !types.Identical(t, errorType) {
			return outputSignature{}, fmt.Errorf("third return type is %s; must be error", types.TypeString(t, nil))
		}
		return outputSignature{
			out:     results.At(0).Type(),
			cleanup: true,
			err:     true,
		}, nil
	default:
		return outputSignature{}, errors.New("too many return values")
	}
}

// processStructLiteralProvider creates a provider for a named struct type.
// It produces pointer and non-pointer variants via two values in Out.
//
// This is a copy of the old processStructProvider, which is deprecated now.
// It will not support any new feature introduced after v0.2. Please use the new
// wire.Struct syntax for those.
func processStructLiteralProvider(fset *token.FileSet, typeName *types.TypeName) (*Provider, []error) {
	out := typeName.Type()
	st, ok := out.Underlying().(*types.Struct)
	if !ok {
		return nil, []error{fmt.Errorf("%v does not name a struct", typeName)}
	}

	pos := typeName.Pos()
	fmt.Fprintf(os.Stderr,
		"Warning: %v, see https://godoc.org/github.com/google/wire#Struct for more information.\n",
		notePosition(fset.Position(pos),
			fmt.Errorf("using struct literal to inject %s is deprecated and will be removed in the next release; use wire.Struct instead",
				typeName.Type())))
	provider := &Provider{
		Pkg:      typeName.Pkg(),
		Name:     typeName.Name(),
		Pos:      pos,
		Args:     make([]ProviderInput, st.NumFields()),
		IsStruct: true,
		Out:      []types.Type{out, types.NewPointer(out)},
	}
	for i := 0; i < st.NumFields(); i++ {
		f := st.Field(i)
		provider.Args[i] = ProviderInput{
			Type:      f.Type(),
			FieldName: f.Name(),
		}
		for j := 0; j < i; j++ {
			if types.Identical(provider.Args[i].Type, provider.Args[j].Type) {
				return nil, []error{notePosition(fset.Position(pos), fmt.Errorf("provider struct has multiple fields of type %s", types.TypeString(provider.Args[j].Type, nil)))}
			}
		}
	}
	return provider, nil
}

// processStructProvider creates a provider for a named struct type.
// It produces pointer and non-pointer variants via two values in Out.
func processStructProvider(fset *token.FileSet, info *types.Info, call *ast.CallExpr) (*Provider, error) {
	// Assumes that call.Fun is wire.Struct.

	if len(call.Args) < 1 {
		return nil, notePosition(fset.Position(call.Pos()),
			errors.New("call to Struct must specify the struct to be injected"))
	}
	const firstArgReqFormat = "first argument to Struct must be a pointer to a named struct; found %s"
	structType := info.TypeOf(call.Args[0])
	structPtr, ok := structType.(*types.Pointer)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf(firstArgReqFormat, types.TypeString(structType, nil)))
	}

	st, ok := structPtr.Elem().Underlying().(*types.Struct)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf(firstArgReqFormat, types.TypeString(structPtr, nil)))
	}

	stExpr := call.Args[0].(*ast.CallExpr)
	typeName := qualifiedIdentObject(info, stExpr.Args[0]) // should be either an identifier or selector
	provider := &Provider{
		Pkg:      typeName.Pkg(),
		Name:     typeName.Name(),
		Pos:      typeName.Pos(),
		IsStruct: true,
		Out:      []types.Type{structPtr.Elem(), structPtr},
	}
	if allFields(call) {
		for i := 0; i < st.NumFields(); i++ {
			if isPrevented(st.Tag(i)) {
				continue
			}
			f := st.Field(i)
			provider.Args = append(provider.Args, ProviderInput{
				Type:      f.Type(),
				FieldName: f.Name(),
			})
		}
	} else {
		provider.Args = make([]ProviderInput, len(call.Args)-1)
		for i := 1; i < len(call.Args); i++ {
			v, err := checkField(call.Args[i], st)
			if err != nil {
				return nil, notePosition(fset.Position(call.Pos()), err)
			}
			provider.Args[i-1] = ProviderInput{
				Type:      v.Type(),
				FieldName: v.Name(),
			}
		}
	}
	for i := 0; i < len(provider.Args); i++ {
		for j := 0; j < i; j++ {
			if types.Identical(provider.Args[i].Type, provider.Args[j].Type) {
				f := st.Field(j)
				return nil, notePosition(fset.Position(f.Pos()), fmt.Errorf("provider struct has multiple fields of type %s", types.TypeString(provider.Args[j].Type, nil)))
			}
		}
	}
	return provider, nil
}

func allFields(call *ast.CallExpr) bool {
	if len(call.Args) != 2 {
		return false
	}
	b, ok := call.Args[1].(*ast.BasicLit)
	if !ok {
		return false
	}
	return strings.EqualFold(strconv.Quote("*"), b.Value)
}

// isPrevented checks whether field i is prevented by tag "-".
// Since this is the only tag used by wire, we can do string comparison
// without using reflect.
func isPrevented(tag string) bool {
	return reflect.StructTag(tag).Get("wire") == "-"
}

// processBind creates an interface binding from a wire.Bind call.
func processBind(fset *token.FileSet, info *types.Info, call *ast.CallExpr) (*IfaceBinding, error) {
	// Assumes that call.Fun is wire.Bind.

	if len(call.Args) != 2 {
		return nil, notePosition(fset.Position(call.Pos()),
			errors.New("call to Bind takes exactly two arguments"))
	}
	// TODO(light): Verify that arguments are simple expressions.
	ifaceArgType := info.TypeOf(call.Args[0])
	ifacePtr, ok := ifaceArgType.(*types.Pointer)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf("first argument to Bind must be a pointer to an interface type; found %s", types.TypeString(ifaceArgType, nil)))
	}
	iface := ifacePtr.Elem()
	methodSet, ok := iface.Underlying().(*types.Interface)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf("first argument to Bind must be a pointer to an interface type; found %s", types.TypeString(ifaceArgType, nil)))
	}

	provided := info.TypeOf(call.Args[1])
	if bindShouldUsePointer(info, call) {
		providedPtr, ok := provided.(*types.Pointer)
		if !ok {
			return nil, notePosition(fset.Position(call.Args[0].Pos()),
				fmt.Errorf("second argument to Bind must be a pointer or a pointer to a pointer; found %s", types.TypeString(provided, nil)))
		}
		provided = providedPtr.Elem()
	}
	if types.Identical(iface, provided) {
		return nil, notePosition(fset.Position(call.Pos()),
			errors.New("cannot bind interface to itself"))
	}
	if !types.Implements(provided, methodSet) {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf("%s does not implement %s", types.TypeString(provided, nil), types.TypeString(iface, nil)))
	}
	return &IfaceBinding{
		Pos:      call.Pos(),
		Iface:    iface,
		Provided: provided,
	}, nil
}

// processValue creates a value from a wire.Value call.
func processValue(fset *token.FileSet, info *types.Info, call *ast.CallExpr) (*Value, error) {
	// Assumes that call.Fun is wire.Value.

	if len(call.Args) != 1 {
		return nil, notePosition(fset.Position(call.Pos()), errors.New("call to Value takes exactly one argument"))
	}
	ok := true
	ast.Inspect(call.Args[0], func(node ast.Node) bool {
		switch expr := node.(type) {
		case nil, *ast.ArrayType, *ast.BasicLit, *ast.BinaryExpr, *ast.ChanType, *ast.CompositeLit, *ast.FuncType, *ast.Ident, *ast.IndexExpr, *ast.InterfaceType, *ast.KeyValueExpr, *ast.MapType, *ast.ParenExpr, *ast.SelectorExpr, *ast.SliceExpr, *ast.StarExpr, *ast.StructType, *ast.TypeAssertExpr:
			// Good!
		case *ast.UnaryExpr:
			if expr.Op == token.ARROW {
				ok = false
				return false
			}
		case *ast.CallExpr:
			// Only acceptable if it's a type conversion.
			if _, isFunc := info.TypeOf(expr.Fun).(*types.Signature); isFunc {
				ok = false
				return false
			}
		default:
			ok = false
			return false
		}
		return true
	})
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()), errors.New("argument to Value is too complex"))
	}
	// Result type can't be an interface type; use wire.InterfaceValue for that.
	argType := info.TypeOf(call.Args[0])
	if _, isInterfaceType := argType.Underlying().(*types.Interface); isInterfaceType {
		return nil, notePosition(fset.Position(call.Pos()), fmt.Errorf("argument to Value may not be an interface value (found %s); use InterfaceValue instead", types.TypeString(argType, nil)))
	}
	return &Value{
		Pos:  call.Args[0].Pos(),
		Out:  info.TypeOf(call.Args[0]),
		expr: call.Args[0],
		info: info,
	}, nil
}

// processInterfaceValue creates a value from a wire.InterfaceValue call.
func processInterfaceValue(fset *token.FileSet, info *types.Info, call *ast.CallExpr) (*Value, error) {
	// Assumes that call.Fun is wire.InterfaceValue.

	if len(call.Args) != 2 {
		return nil, notePosition(fset.Position(call.Pos()), errors.New("call to InterfaceValue takes exactly two arguments"))
	}
	ifaceArgType := info.TypeOf(call.Args[0])
	ifacePtr, ok := ifaceArgType.(*types.Pointer)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()), fmt.Errorf("first argument to InterfaceValue must be a pointer to an interface type; found %s", types.TypeString(ifaceArgType, nil)))
	}
	iface := ifacePtr.Elem()
	methodSet, ok := iface.Underlying().(*types.Interface)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()), fmt.Errorf("first argument to InterfaceValue must be a pointer to an interface type; found %s", types.TypeString(ifaceArgType, nil)))
	}
	provided := info.TypeOf(call.Args[1])
	if !types.Implements(provided, methodSet) {
		return nil, notePosition(fset.Position(call.Pos()), fmt.Errorf("%s does not implement %s", types.TypeString(provided, nil), types.TypeString(iface, nil)))
	}
	return &Value{
		Pos:  call.Args[1].Pos(),
		Out:  iface,
		expr: call.Args[1],
		info: info,
	}, nil
}

// processFieldsOf creates a slice of fields from a wire.FieldsOf call.
func processFieldsOf(fset *token.FileSet, info *types.Info, call *ast.CallExpr) ([]*Field, error) {
	// Assumes that call.Fun is wire.FieldsOf.

	if len(call.Args) < 2 {
		return nil, notePosition(fset.Position(call.Pos()),
			errors.New("call to FieldsOf must specify fields to be extracted"))
	}
	const firstArgReqFormat = "first argument to FieldsOf must be a pointer to a struct or a pointer to a pointer to a struct; found %s"
	structType := info.TypeOf(call.Args[0])
	structPtr, ok := structType.(*types.Pointer)
	if !ok {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf(firstArgReqFormat, types.TypeString(structType, nil)))
	}

	var struc *types.Struct
	isPtrToStruct := false
	switch t := structPtr.Elem().Underlying().(type) {
	case *types.Pointer:
		struc, ok = t.Elem().Underlying().(*types.Struct)
		if !ok {
			return nil, notePosition(fset.Position(call.Pos()),
				fmt.Errorf(firstArgReqFormat, types.TypeString(struc, nil)))
		}
		isPtrToStruct = true
	case *types.Struct:
		struc = t
	default:
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf(firstArgReqFormat, types.TypeString(t, nil)))
	}
	if struc.NumFields() < len(call.Args)-1 {
		return nil, notePosition(fset.Position(call.Pos()),
			fmt.Errorf("fields number exceeds the number available in the struct which has %d fields", struc.NumFields()))
	}

	fields := make([]*Field, 0, len(call.Args)-1)
	for i := 1; i < len(call.Args); i++ {
		v, err := checkField(call.Args[i], struc)
		if err != nil {
			return nil, notePosition(fset.Position(call.Pos()), err)
		}
		out := []types.Type{v.Type()}
		if isPtrToStruct {
			// If the field is from a pointer to a struct, then
			// wire.Fields also provides a pointer to the field.
			out = append(out, types.NewPointer(v.Type()))
		}
		fields = append(fields, &Field{
			Parent: structPtr.Elem(),
			Name:   v.Name(),
			Pkg:    v.Pkg(),
			Pos:    v.Pos(),
			Out:    out,
		})
	}
	return fields, nil
}

// checkField reports whether f is a field of st. f should be a string with the
// field name.
func checkField(f ast.Expr, st *types.Struct) (*types.Var, error) {
	b, ok := f.(*ast.BasicLit)
	if !ok {
		return nil, fmt.Errorf("%v must be a string with the field name", f)
	}
	for i := 0; i < st.NumFields(); i++ {
		if strings.EqualFold(strconv.Quote(st.Field(i).Name()), b.Value) {
			if isPrevented(st.Tag(i)) {
				return nil, fmt.Errorf("%s is prevented from injecting by wire", b.Value)
			}
			return st.Field(i), nil
		}
	}
	return nil, fmt.Errorf("%s is not a field of %s", b.Value, st.String())
}

// findInjectorBuild returns the wire.Build call if fn is an injector template.
// It returns nil if the function is not an injector template.
func findInjectorBuild(info *types.Info, fn *ast.FuncDecl) (*ast.CallExpr, error) {
	if fn.Body == nil {
		return nil, nil
	}
	numStatements := 0
	invalid := false
	var wireBuildCall *ast.CallExpr
	for _, stmt := range fn.Body.List {
		switch stmt := stmt.(type) {
		case *ast.ExprStmt:
			numStatements++
			if numStatements > 1 {
				invalid = true
			}
			call, ok := stmt.X.(*ast.CallExpr)
			if !ok {
				continue
			}
			if qualifiedIdentObject(info, call.Fun) == types.Universe.Lookup("panic") {
				if len(call.Args) != 1 {
					continue
				}
				call, ok = call.Args[0].(*ast.CallExpr)
				if !ok {
					continue
				}
			}
			buildObj := qualifiedIdentObject(info, call.Fun)
			if buildObj == nil || buildObj.Pkg() == nil || !isWireImport(buildObj.Pkg().Path()) || buildObj.Name() != "Build" {
				continue
			}
			wireBuildCall = call
		case *ast.EmptyStmt:
			// Do nothing.
		case *ast.ReturnStmt:
			// Allow the function to end in a return.
			if numStatements == 0 {
				return nil, nil
			}
		default:
			invalid = true
		}

	}
	if wireBuildCall == nil {
		return nil, nil
	}
	if invalid {
		return nil, errors.New("a call to wire.Build indicates that this function is an injector, but injectors must consist of only the wire.Build call and an optional return")
	}
	return wireBuildCall, nil
}

func isWireImport(path string) bool {
	// TODO(light): This is depending on details of the current loader.
	const vendorPart = "vendor/"
	if i := strings.LastIndex(path, vendorPart); i != -1 && (i == 0 || path[i-1] == '/') {
		path = path[i+len(vendorPart):]
	}
	return path == "github.com/grafana/grafana/pkg/build/wire" || path == "github.com/google/wire"
}

func isProviderSetType(t types.Type) bool {
	n, ok := t.(*types.Named)
	if !ok {
		return false
	}
	obj := n.Obj()
	return obj.Pkg() != nil && isWireImport(obj.Pkg().Path()) && obj.Name() == "ProviderSet"
}

// ProvidedType represents a type provided from a source. The source
// can be a *Provider (a provider function), a *Value (wire.Value), or an
// *InjectorArgs (arguments to the injector function). The zero value has
// none of the above, and returns true for IsNil.
type ProvidedType struct {
	// t is the provided concrete type.
	t types.Type
	p *Provider
	v *Value
	a *InjectorArg
	f *Field
}

// IsNil reports whether pt is the zero value.
func (pt ProvidedType) IsNil() bool {
	return pt.p == nil && pt.v == nil && pt.a == nil && pt.f == nil
}

// Type returns the output type.
//
//   - For a function provider, this is the first return value type.
//   - For a struct provider, this is either the struct type or the pointer type
//     whose element type is the struct type.
//   - For a value, this is the type of the expression.
//   - For an argument, this is the type of the argument.
func (pt ProvidedType) Type() types.Type {
	return pt.t
}

// IsProvider reports whether pt points to a Provider.
func (pt ProvidedType) IsProvider() bool {
	return pt.p != nil
}

// IsValue reports whether pt points to a Value.
func (pt ProvidedType) IsValue() bool {
	return pt.v != nil
}

// IsArg reports whether pt points to an injector argument.
func (pt ProvidedType) IsArg() bool {
	return pt.a != nil
}

// IsField reports whether pt points to a Fields.
func (pt ProvidedType) IsField() bool {
	return pt.f != nil
}

// Provider returns pt as a Provider pointer. It panics if pt does not point
// to a Provider.
func (pt ProvidedType) Provider() *Provider {
	if pt.p == nil {
		panic("ProvidedType does not hold a Provider")
	}
	return pt.p
}

// Value returns pt as a Value pointer. It panics if pt does not point
// to a Value.
func (pt ProvidedType) Value() *Value {
	if pt.v == nil {
		panic("ProvidedType does not hold a Value")
	}
	return pt.v
}

// Arg returns pt as an *InjectorArg representing an injector argument. It
// panics if pt does not point to an arg.
func (pt ProvidedType) Arg() *InjectorArg {
	if pt.a == nil {
		panic("ProvidedType does not hold an Arg")
	}
	return pt.a
}

// Field returns pt as a Field pointer. It panics if pt does not point to a
// struct Field.
func (pt ProvidedType) Field() *Field {
	if pt.f == nil {
		panic("ProvidedType does not hold a Field")
	}
	return pt.f
}

// bindShouldUsePointer loads the wire package the user is importing from their
// injector. The call is a wire marker function call.
func bindShouldUsePointer(info *types.Info, call *ast.CallExpr) bool {
	// These type assertions should not fail, otherwise panic.
	fun := call.Fun.(*ast.SelectorExpr)                 // wire.Bind
	pkgName := fun.X.(*ast.Ident)                       // wire
	wireName := info.ObjectOf(pkgName).(*types.PkgName) // wire package
	return wireName.Imported().Scope().Lookup("bindToUsePointer") != nil
}
