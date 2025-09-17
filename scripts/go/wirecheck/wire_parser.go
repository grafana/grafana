package wirecheck

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"strings"
	"sync"
)

// WireParser handles parsing of wire_gen.go files to extract provider functions.
// It caches parsed results to avoid re-parsing the same file multiple times.
type WireParser struct {
	mu                sync.RWMutex
	wireFunctions     map[string]map[string]bool // Cache: import_path -> function -> true
	importMap         map[string]string          // Mapping from package aliases to import paths
	wireGenPackage    string
	wireGenImportPath string
}

// NewWireParser creates a new WireParser instance.
func NewWireParser() *WireParser {
	return &WireParser{}
}

func (wp *WireParser) Parse(wireGenFilePath string) error {
	if wireGenFilePath == "" {
		return fmt.Errorf("file path cannot be empty")
	}

	// Check cache first
	wp.mu.RLock()
	if wp.wireFunctions != nil {
		wp.mu.RUnlock()
		return nil
	}
	wp.mu.RUnlock()

	// Parse and cache
	wp.mu.Lock()
	defer wp.mu.Unlock()

	// Double-check after acquiring write lock
	if wp.wireFunctions != nil {
		return nil
	}

	err := wp.parseFile(wireGenFilePath)
	if err != nil {
		return fmt.Errorf("failed to parse wire_gen.go file %q: %w", wireGenFilePath, err)
	}

	return nil
}

// ShouldAnalyzeFunction checks if a function in the given package should be analyzed.
// It returns true if the function is referenced in the wire_gen.go file.
// pkgImportPath should be the full import path of the package being analyzed.
func (wp *WireParser) ShouldAnalyzeFunction(pkgImportPath, funcName string) bool {
	wp.mu.RLock()
	defer wp.mu.RUnlock()

	if wp.wireFunctions == nil {
		return false
	}

	// Check if the package exists in our wire functions using import path
	if pkgFunctions, exists := wp.wireFunctions[pkgImportPath]; exists {
		// Check if the function exists in this package
		return pkgFunctions[funcName]
	}

	return false
}

// parseFile performs the actual parsing of the wire_gen.go file.
func (wp *WireParser) parseFile(filePath string) error {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return err
	}

	// Set private variables
	wp.importMap = wp.buildImportMap(file)
	wp.wireGenPackage = file.Name.Name
	wp.wireFunctions = make(map[string]map[string]bool)

	// Extract provider functions from all function declarations
	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			if funcDecl.Name.Name == "Initialize" {
				wp.extractProviderFunctions(funcDecl)
			}
		}
		return true
	})
	return nil
}

// buildImportMap creates a mapping from package aliases to their full import paths.
func (wp *WireParser) buildImportMap(file *ast.File) map[string]string {
	importMap := make(map[string]string)

	for _, imp := range file.Imports {
		if imp.Path == nil {
			continue
		}

		importPath := strings.Trim(imp.Path.Value, "\"")

		if imp.Name != nil {
			// Named import: import alias "path"
			importMap[imp.Name.Name] = importPath
		} else {
			// Default import: import "path" - extract package name from path
			if pkgName := wp.extractPackageName(importPath); pkgName != "" {
				importMap[pkgName] = importPath
			}
		}
	}

	return importMap
}

// extractPackageName extracts the package name from an import path.
func (wp *WireParser) extractPackageName(importPath string) string {
	parts := strings.Split(importPath, "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

// extractProviderFunctions extracts provider function calls from a function declaration.
func (wp *WireParser) extractProviderFunctions(funcDecl *ast.FuncDecl) {
	ast.Inspect(funcDecl, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			wp.extractProviderFromCall(callExpr)
		}
		return true
	})
}

// extractProviderFromCall extracts provider function names from a call expression.
func (wp *WireParser) extractProviderFromCall(callExpr *ast.CallExpr) {
	switch fun := callExpr.Fun.(type) {
	case *ast.Ident:
		// Direct function call: ProvideService()
		// Use the wire_gen.go package name as the package
		wp.addProviderFunction(wp.wireGenPackage, fun.Name)

	case *ast.SelectorExpr:
		// Package function call: package.ProvideService()
		if pkgIdent, ok := fun.X.(*ast.Ident); ok {
			wp.addProviderFunction(pkgIdent.Name, fun.Sel.Name)
		}
	}
}

// addProviderFunction adds a provider function to the wire functions map.
// It always uses import paths as keys for consistent lookup.
func (wp *WireParser) addProviderFunction(pkgName, funcName string) {
	var importPath string

	if fullPath, exists := wp.importMap[pkgName]; exists {
		// External package - use the full import path
		importPath = fullPath
	} else {
		// Local package function (no package prefix) - use wire_gen.go's import path
		importPath = wp.wireGenImportPath
	}

	if wp.wireFunctions[importPath] == nil {
		wp.wireFunctions[importPath] = make(map[string]bool)
	}
	wp.wireFunctions[importPath][funcName] = true
}
