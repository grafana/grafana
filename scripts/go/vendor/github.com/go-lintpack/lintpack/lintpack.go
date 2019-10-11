package lintpack

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"

	"github.com/go-toolsmith/astfmt"
)

// CheckerCollection provides additional information for a group of checkers.
type CheckerCollection struct {
	// URL is a link for a main source of information on the collection.
	URL string
}

// AddChecker registers a new checker into a checkers pool.
// Constructor is used to create a new checker instance.
// Checker name (defined in CheckerInfo.Name) must be unique.
//
// CheckerInfo.Collection is automatically set to the coll (the receiver).
//
// If checker is never needed, for example if it is disabled,
// constructor will not be called.
func (coll *CheckerCollection) AddChecker(info *CheckerInfo, constructor func(*CheckerContext) FileWalker) {
	if coll == nil {
		panic(fmt.Sprintf("adding checker to a nil collection"))
	}
	info.Collection = coll
	addChecker(info, constructor)
}

// CheckerParam describes a single checker customizable parameter.
type CheckerParam struct {
	// Value holds parameter bound value.
	// It might be overwritten by the integrating linter.
	//
	// Permitted types include:
	//	- int
	//	- bool
	//	- string
	Value interface{}

	// Usage gives an overview about what parameter does.
	Usage string
}

// CheckerParams holds all checker-specific parameters.
//
// Provides convenient access to the loosely typed underlying map.
type CheckerParams map[string]*CheckerParam

// Int lookups pname key in underlying map and type-asserts it to int.
func (params CheckerParams) Int(pname string) int { return params[pname].Value.(int) }

// Bool lookups pname key in underlying map and type-asserts it to bool.
func (params CheckerParams) Bool(pname string) bool { return params[pname].Value.(bool) }

// String lookups pname key in underlying map and type-asserts it to string.
func (params CheckerParams) String(pname string) string { return params[pname].Value.(string) }

// CheckerInfo holds checker metadata and structured documentation.
type CheckerInfo struct {
	// Name is a checker name.
	Name string

	// Tags is a list of labels that can be used to enable or disable checker.
	// Common tags are "experimental" and "performance".
	Tags []string

	// Params declares checker-specific parameters. Optional.
	Params CheckerParams

	// Summary is a short one sentence description.
	// Should not end with a period.
	Summary string

	// Details extends summary with additional info. Optional.
	Details string

	// Before is a code snippet of code that will violate rule.
	Before string

	// After is a code snippet of fixed code that complies to the rule.
	After string

	// Note is an optional caution message or advice.
	Note string

	// Collection establishes a checker-to-collection relationship.
	Collection *CheckerCollection
}

// GetCheckersInfo returns a checkers info list for all registered checkers.
// The slice is sorted by a checker name.
//
// Info objects can be used to instantiate checkers with NewChecker function.
func GetCheckersInfo() []*CheckerInfo {
	return getCheckersInfo()
}

// HasTag reports whether checker described by the info has specified tag.
func (info *CheckerInfo) HasTag(tag string) bool {
	for i := range info.Tags {
		if info.Tags[i] == tag {
			return true
		}
	}
	return false
}

// Checker is an implementation of a check that is described by the associated info.
type Checker struct {
	// Info is an info object that was used to instantiate this checker.
	Info *CheckerInfo

	ctx CheckerContext

	fileWalker FileWalker
}

// Check runs rule checker over file f.
func (c *Checker) Check(f *ast.File) []Warning {
	c.ctx.warnings = c.ctx.warnings[:0]
	c.fileWalker.WalkFile(f)
	return c.ctx.warnings
}

// Warning represents issue that is found by checker.
type Warning struct {
	// Node is an AST node that caused warning to trigger.
	// Can be used to obtain proper error location.
	Node ast.Node

	// Text is warning message without source location info.
	Text string
}

// NewChecker returns initialized checker identified by an info.
// info must be non-nil.
// Panics if info describes a checker that was not properly registered.
func NewChecker(ctx *Context, info *CheckerInfo) *Checker {
	return newChecker(ctx, info)
}

// Context is a readonly state shared among every checker.
type Context struct {
	// TypesInfo carries parsed packages types information.
	TypesInfo *types.Info

	// SizesInfo carries alignment and type size information.
	// Arch-dependent.
	SizesInfo types.Sizes

	// FileSet is a file set that was used during the program loading.
	FileSet *token.FileSet

	// Pkg describes package that is being checked.
	Pkg *types.Package

	// Filename is a currently checked file name.
	Filename string

	// Require records what optional resources are required
	// by the checkers set that use this context.
	//
	// Every require fields makes associated context field
	// to be properly initialized.
	// For example, Context.require.PkgObjects => Context.PkgObjects.
	Require struct {
		PkgObjects bool
		PkgRenames bool
	}

	// PkgObjects stores all imported packages and their local names.
	PkgObjects map[*types.PkgName]string

	// PkgRenames maps package path to its local renaming.
	// Contains no entries for packages that were imported without
	// explicit local names.
	PkgRenames map[string]string
}

// NewContext returns new shared context to be used by every checker.
//
// All data carried by the context is readonly for checkers,
// but can be modified by the integrating application.
func NewContext(fset *token.FileSet, sizes types.Sizes) *Context {
	return &Context{
		FileSet:   fset,
		SizesInfo: sizes,
		TypesInfo: &types.Info{},
	}
}

// SetPackageInfo sets package-related metadata.
//
// Must be called for every package being checked.
func (c *Context) SetPackageInfo(info *types.Info, pkg *types.Package) {
	if info != nil {
		// We do this kind of assignment to avoid
		// changing c.typesInfo field address after
		// every re-assignment.
		*c.TypesInfo = *info
	}
	c.Pkg = pkg
}

// SetFileInfo sets file-related metadata.
//
// Must be called for every source code file being checked.
func (c *Context) SetFileInfo(name string, f *ast.File) {
	c.Filename = name
	if c.Require.PkgObjects {
		resolvePkgObjects(c, f)
	}
	if c.Require.PkgRenames {
		resolvePkgRenames(c, f)
	}
}

// CheckerContext is checker-local context copy.
// Fields that are not from Context itself are writeable.
type CheckerContext struct {
	*Context

	// printer used to format warning text.
	printer *astfmt.Printer

	warnings []Warning
}

// Warn adds a Warning to checker output.
func (ctx *CheckerContext) Warn(node ast.Node, format string, args ...interface{}) {
	ctx.warnings = append(ctx.warnings, Warning{
		Text: ctx.printer.Sprintf(format, args...),
		Node: node,
	})
}

// FileWalker is an interface every checker should implement.
//
// The WalkFile method is executed for every Go file inside the
// package that is being checked.
type FileWalker interface {
	WalkFile(*ast.File)
}
