package wirecheck

import (
	"go/ast"
	"go/parser"
	"go/token"
	"go/types"
	"strings"

	"github.com/golangci/plugin-module-register/register"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

func init() {
	register.Plugin("wirecheck", New)
}

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

// WireChecker represents the wire-checker plugin
type WireChecker struct {
	settings Settings
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

	return &WireChecker{settings: s}, nil
}

// BuildAnalyzers returns the analyzers for the wire-checker plugin
func (w *WireChecker) BuildAnalyzers() ([]*analysis.Analyzer, error) {
	return []*analysis.Analyzer{
		{
			Name:     "wirechecker",
			Doc:      "check for direct dependency method calls in wire provider functions",
			Run:      w.run,
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
		// Don't analyze anything if no wire-gen file is specified
		return nil, nil
	}

	// Get the inspector from the required analyzer
	insp := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)

	// Parse the wire_gen.go file to find provider functions
	wireFunctions, err := w.parseWireGenFile(w.settings.WireGen)
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
		if wireFunctions[funcDecl.Name.Name] {
			w.analyzeProviderFunctionForTightCoupling(pass, funcDecl, []string{funcDecl.Name.Name})
		}
	})

	return nil, nil
}

func (w *WireChecker) parseWireGenFile(filePath string) (map[string]bool, error) {
	wireFunctions := make(map[string]bool)

	// Parse the wire_gen.go file
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	// Look for Initialize functions and extract provider function calls
	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			if funcDecl.Name.Name == "Initialize" || strings.HasPrefix(funcDecl.Name.Name, "Initialize") {
				extractProviderFunctionsFromInitialize(funcDecl, wireFunctions)
			}
		}
		return true
	})

	return wireFunctions, nil
}

func extractProviderFunctionsFromInitialize(funcDecl *ast.FuncDecl, wireFunctions map[string]bool) {
	// Walk through the Initialize function body and find provider function calls
	ast.Inspect(funcDecl, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			extractProviderFromCall(callExpr, wireFunctions)
		}
		return true
	})
}

func extractProviderFromCall(callExpr *ast.CallExpr, wireFunctions map[string]bool) {
	switch fun := callExpr.Fun.(type) {
	case *ast.Ident:
		// Direct function call: ProvideService()
		wireFunctions[fun.Name] = true
	case *ast.SelectorExpr:
		// Package function call: package.ProvideService()
		wireFunctions[fun.Sel.Name] = true
	}
}

func (w *WireChecker) analyzeProviderFunctionForTightCoupling(pass *analysis.Pass, funcDecl *ast.FuncDecl, callPath []string) {
	// Find method calls on parameters (dependencies) within this provider function
	calls := w.findMethodCallsInFunction(funcDecl, pass.Fset, pass.TypesInfo)

	for _, call := range calls {
		call.callPath = callPath
		// Report at the exact location of the method call
		message := funcDecl.Name.Name + "() directly calls " + call.receiver + "." + call.method + "() in wire provider function"
		if len(callPath) > 1 {
			message += " (via call path: " + strings.Join(callPath, " -> ") + ")"
		}

		pass.Report(analysis.Diagnostic{
			Pos:     call.pos,
			Message: message,
		})
	}

	// If recursive analysis is enabled, analyze function calls within this provider
	if w.settings.Recursive {
		functionCalls := w.findFunctionCallsInFunction(funcDecl, pass.Fset, pass.TypesInfo)
		w.analyzeRecursiveFunctionCalls(pass, functionCalls, callPath)
	}
}

func (w *WireChecker) findMethodCallsInFunction(funcDecl *ast.FuncDecl, fset *token.FileSet, info *types.Info) []methodCall {
	var calls []methodCall

	ast.Inspect(funcDecl, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
				if ident, ok := selExpr.X.(*ast.Ident); ok {
					if isParameter(ident, funcDecl) {
						calls = append(calls, methodCall{
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

	return calls
}

func isParameter(ident *ast.Ident, funcDecl *ast.FuncDecl) bool {
	// Check if the identifier is a function parameter
	for _, field := range funcDecl.Type.Params.List {
		for _, name := range field.Names {
			if name.Name == ident.Name {
				return true
			}
		}
	}
	return false
}

// findFunctionCallsInFunction finds all function calls within a provider function
func (w *WireChecker) findFunctionCallsInFunction(funcDecl *ast.FuncDecl, fset *token.FileSet, info *types.Info) []functionCall {
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

// analyzeRecursiveFunctionCalls recursively analyzes function calls to detect transitive dependencies
func (w *WireChecker) analyzeRecursiveFunctionCalls(pass *analysis.Pass, functionCalls []functionCall, callPath []string) {
	// Prevent infinite recursion by checking call path depth and cycles
	if len(callPath) > 10 { // Max recursion depth
		return
	}

	for _, funcCall := range functionCalls {
		// Skip if this function is already in the call path (cycle detection)
		if w.containsFunction(callPath, funcCall.funcName) {
			continue
		}

		// Try to find the function declaration in the current package
		funcDecl := w.findFunctionDeclaration(pass, funcCall.funcName, funcCall.pkg)
		if funcDecl != nil {
			newCallPath := append(callPath, funcCall.funcName)
			w.analyzeProviderFunctionForTightCoupling(pass, funcDecl, newCallPath)
		}
	}
}

// containsFunction checks if a function name is already in the call path
func (w *WireChecker) containsFunction(callPath []string, funcName string) bool {
	for _, name := range callPath {
		if name == funcName {
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
