package wirecheck

import (
	"flag"
	"fmt"
	"go/ast"
	"go/token"

	"github.com/golangci/plugin-module-register/register"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

// Settings represents the configuration for the wire-checker plugin
type Settings struct {
	WireGen   string `json:"wire-gen"`  // Path to wire_gen.go file
	Recursive bool   `json:"recursive"` // Enable recursive analysis
}

// methodCall represents a method call found in a provider function
type methodCall struct {
	receiver string
	method   string
	line     int
	pos      token.Pos
	callPath []string // Track the call path for recursive calls
}

// functionCall represents a function call that needs to be analyzed recursively
type functionCall struct {
	funcName string
	pos      token.Pos
	pkg      string
}

// DependencyParam represents a parameter that is a wire dependency
type DependencyParam struct {
	Name     string
	Type     string
	Position int
}

// ParameterFlow tracks how wire dependencies flow through function calls
type ParameterFlow struct {
	SourceParam DependencyParam
	CallSite    token.Pos
	TargetParam DependencyParam
}

// WireChecker represents the wire-checker plugin
type WireChecker struct {
	settings   Settings
	wireParser *WireParser
}

// SetSettings allows setting the configuration for standalone usage
func (w *WireChecker) SetSettings(settings Settings) {
	w.settings = settings
}

// New creates a new instance of the wire-checker plugin for golangci-lint
func New(settings any) (register.LinterPlugin, error) {
	s, err := register.DecodeSettings[Settings](settings)
	if err != nil {
		return nil, err
	}

	return &WireChecker{
		settings:   s,
		wireParser: NewWireParser(),
	}, nil
}

// BuildAnalyzers returns the analyzers for the wire-checker plugin
func (w *WireChecker) BuildAnalyzers() ([]*analysis.Analyzer, error) {
	fs := flag.NewFlagSet("wirechecker", flag.ExitOnError)
	fs.StringVar(&w.settings.WireGen, "wire-gen", w.settings.WireGen, "path to wire_gen.go file to analyze provider functions from")
	fs.BoolVar(&w.settings.Recursive, "recursive", w.settings.Recursive, "enable recursive analysis of function calls")
	return []*analysis.Analyzer{
		{
			Name:     "wirecheck",
			Doc:      "check for direct dependency method calls in wire provider functions",
			Run:      w.run,
			Flags:    *fs,
			Requires: []*analysis.Analyzer{inspect.Analyzer},
		},
	}, nil
}

// GetLoadMode returns the load mode for the analyzer
func (w *WireChecker) GetLoadMode() string {
	return register.LoadModeTypesInfo
}

// run is the main analysis function for the wire-checker
func (w *WireChecker) run(pass *analysis.Pass) (interface{}, error) {

	// Require wire-gen setting to be specified
	if w.settings.WireGen == "" {
		return nil, fmt.Errorf("wire-gen setting is required")
	}

	// Get the inspector from the required analyzer
	insp := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)

	err := w.wireParser.Parse(w.settings.WireGen)
	if err != nil {
		// Report error and skip analysis if wire_gen.go parsing fails
		pass.Report(analysis.Diagnostic{
			Pos:     0,
			Message: "failed to parse wire-gen file " + w.settings.WireGen + ": " + err.Error(),
		})
		return nil, nil
	}

	// Analyze only functions that are referenced in the wire_gen.go file
	nodeFilter := []ast.Node{
		(*ast.FuncDecl)(nil),
	}

	insp.Preorder(nodeFilter, func(n ast.Node) {
		funcDecl := n.(*ast.FuncDecl)

		// Only analyze functions that are actually used in wire dependency injection
		funcName := funcDecl.Name.Name

		// Check if this function should be analyzed using the wire parser helper
		// Use the package's import path for consistent lookup
		pkgImportPath := pass.Pkg.Path()
		if w.wireParser.ShouldAnalyzeFunction(pkgImportPath, funcName) {
			w.analyzeProviderFunctionForTightCoupling(pass, funcDecl, []analysis.RelatedInformation{})
		}
	})

	return nil, nil
}

func (w *WireChecker) analyzeProviderFunctionForTightCoupling(pass *analysis.Pass, funcDecl *ast.FuncDecl, related []analysis.RelatedInformation) {
	// For wire provider functions, all parameters are wire dependencies
	wireDependencies := w.extractParameterNames(funcDecl)

	// Analyze this function with parameter flow tracking
	w.analyzeWithParameterFlow(pass, funcDecl, related, wireDependencies)
}

func (w *WireChecker) analyzeWithParameterFlow(pass *analysis.Pass, funcDecl *ast.FuncDecl, related []analysis.RelatedInformation, wireDependencies map[string]bool) {
	// Find method calls on wire dependencies in this function
	calls := w.findMethodCallsOnTrackedDependencies(funcDecl, pass.Fset, wireDependencies)

	for _, call := range calls {
		if !call.pos.IsValid() {
			continue
		}
		pass.Report(analysis.Diagnostic{
			Pos:     call.pos,
			Message: "Wire provider dependency method called",
			Related: related,
		})
	}

	// If recursive analysis is enabled, find function calls and track parameter flow
	if w.settings.Recursive {
		functionCalls := w.findFunctionCallsInFunction(funcDecl)
		for _, funcCall := range functionCalls {
			if w.containsFunction(related, funcCall) {
				continue
			}

			// Find the target function declaration
			targetFunc := w.findFunctionDeclaration(pass, funcCall.funcName, funcCall.pkg)
			if targetFunc != nil {
				// Track which parameters flow from this call to the target function
				flows := w.extractParameterFlowFromCall(funcCall, funcDecl, targetFunc, wireDependencies)

				// Create new wire dependencies map for the target function
				targetWireDeps := make(map[string]bool)
				for _, flow := range flows {
					targetWireDeps[flow.TargetParam.Name] = true
				}

				if len(targetWireDeps) > 0 {
					newRelated := append(related, analysis.RelatedInformation{
						Pos:     funcCall.pos,
						Message: "This function call results in dependency method call",
					})
					w.analyzeWithParameterFlow(pass, targetFunc, newRelated, targetWireDeps)
				}
			}
		}
	}
}

// findMethodCallsOnTrackedDependencies finds method calls on specific tracked wire dependencies
func (w *WireChecker) findMethodCallsOnTrackedDependencies(funcDecl *ast.FuncDecl, fset *token.FileSet, wireDependencies map[string]bool) []methodCall {
	var calls []methodCall
	w.findMethodCallsInScope(funcDecl, fset, &calls, wireDependencies)
	return calls
}

// findMethodCallsInScope recursively finds method calls on tracked wire dependencies
func (w *WireChecker) findMethodCallsInScope(node ast.Node, fset *token.FileSet, calls *[]methodCall, wireDependencies map[string]bool) {
	ast.Inspect(node, func(n ast.Node) bool {
		// When we encounter a function literal, recursively check it but keep tracking the same wire dependencies
		if funcLit, ok := n.(*ast.FuncLit); ok {
			w.findMethodCallsInScope(funcLit.Body, fset, calls, wireDependencies)
			return false // Don't continue inspecting this node's children
		}

		if callExpr, ok := n.(*ast.CallExpr); ok {
			if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
				if ident, ok := selExpr.X.(*ast.Ident); ok {
					// Only check method calls on tracked wire dependencies
					if wireDependencies[ident.Name] {
						*calls = append(*calls, methodCall{
							receiver: ident.Name,
							method:   selExpr.Sel.Name,
							line:     fset.Position(callExpr.Pos()).Line,
							pos:      callExpr.Pos(),
						})
					}
				}
			}
		}
		return true
	})
}

// extractParameterNames returns a map of parameter names for the given function
func (w *WireChecker) extractParameterNames(funcDecl *ast.FuncDecl) map[string]bool {
	params := make(map[string]bool)
	if funcDecl.Type.Params != nil {
		for _, field := range funcDecl.Type.Params.List {
			for _, name := range field.Names {
				params[name.Name] = true
			}
		}
	}
	return params
}

// extractParameterFlowFromCall analyzes a function call to determine which wire dependencies
// flow from the calling function to the called function
func (w *WireChecker) extractParameterFlowFromCall(funcCall functionCall, callingFunc *ast.FuncDecl, targetFunc *ast.FuncDecl, wireDependencies map[string]bool) []ParameterFlow {
	var flows []ParameterFlow

	// Find the actual call expression in the calling function
	var callExpr *ast.CallExpr
	ast.Inspect(callingFunc, func(n ast.Node) bool {
		if ce, ok := n.(*ast.CallExpr); ok && ce.Pos() == funcCall.pos {
			callExpr = ce
			return false
		}
		return true
	})

	if callExpr == nil {
		return flows
	}

	// Get target function parameters
	targetParams := w.extractDependencyParams(targetFunc)

	// Match arguments to parameters
	for i, arg := range callExpr.Args {
		if i >= len(targetParams) {
			break
		}

		// Check if this argument is a wire dependency
		if ident, ok := arg.(*ast.Ident); ok {
			if wireDependencies[ident.Name] {
				flows = append(flows, ParameterFlow{
					SourceParam: DependencyParam{
						Name:     ident.Name,
						Position: i,
					},
					CallSite:    funcCall.pos,
					TargetParam: targetParams[i],
				})
			}
		}
	}

	return flows
}

// extractDependencyParams returns a slice of DependencyParam for the given function
func (w *WireChecker) extractDependencyParams(funcDecl *ast.FuncDecl) []DependencyParam {
	var params []DependencyParam
	if funcDecl.Type.Params != nil {
		pos := 0
		for _, field := range funcDecl.Type.Params.List {
			for _, name := range field.Names {
				params = append(params, DependencyParam{
					Name:     name.Name,
					Type:     w.typeToString(field.Type),
					Position: pos,
				})
				pos++
			}
		}
	}
	return params
}

// typeToString converts an AST type expression to a string representation
func (w *WireChecker) typeToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		if pkg, ok := t.X.(*ast.Ident); ok {
			return pkg.Name + "." + t.Sel.Name
		}
		return t.Sel.Name
	case *ast.StarExpr:
		return "*" + w.typeToString(t.X)
	default:
		return "unknown"
	}
}

// findFunctionCallsInFunction finds all function calls within a provider function
func (w *WireChecker) findFunctionCallsInFunction(funcDecl *ast.FuncDecl) []functionCall {
	var calls []functionCall

	ast.Inspect(funcDecl, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			switch fun := callExpr.Fun.(type) {
			case *ast.Ident:
				// Direct function call: SomeFunction()
				calls = append(calls, functionCall{
					funcName: fun.Name,
					pos:      callExpr.Pos(),
					pkg:      "", // Same package
				})
			case *ast.SelectorExpr:
				// Package function call: package.SomeFunction()
				if pkgIdent, ok := fun.X.(*ast.Ident); ok {
					calls = append(calls, functionCall{
						funcName: fun.Sel.Name,
						pos:      callExpr.Pos(),
						pkg:      pkgIdent.Name,
					})
				}
			}
		}
		return true
	})

	return calls
}

// containsFunction checks if a function name is already in the call path
func (w *WireChecker) containsFunction(callPath []analysis.RelatedInformation, funcCall functionCall) bool {
	for _, related := range callPath {
		if related.Pos == funcCall.pos {
			return true
		}
	}
	return false
}

// findFunctionDeclaration finds a function declaration by name in the current analysis pass
func (w *WireChecker) findFunctionDeclaration(pass *analysis.Pass, funcName, pkg string) *ast.FuncDecl {
	for _, file := range pass.Files {
		for _, decl := range file.Decls {
			if funcDecl, ok := decl.(*ast.FuncDecl); ok {
				if funcDecl.Name.Name == funcName {
					// If pkg is specified, we need to check if this is from the right package
					// For now, we'll assume same package if pkg is empty
					if pkg == "" || pkg == pass.Pkg.Name() {
						return funcDecl
					}
				}
			}
		}
	}
	return nil
}
