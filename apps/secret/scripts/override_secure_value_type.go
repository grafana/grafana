package main

import (
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/tools/go/ast/astutil"
)

const (
	rawSecureValueType         = "RawSecureValue"
	rawSecureValuePackage      = "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	rawSecureValuePackageAlias = "common"
	typeImportName             = rawSecureValuePackageAlias + "." + rawSecureValueType
)

func main() {
	if len(os.Args) != 3 {
		fmt.Println("Usage: go run override_secure_value_type.go <type_to_replace> <path_to_search_for_type>")
		os.Exit(1)
	}

	typeToReplace := os.Args[1]
	pkgDir := os.Args[2]

	fmt.Printf("=> Looking for type %s in %s\n", typeToReplace, pkgDir)
	fmt.Printf("=> Replacing it with %s (from %s)\n", typeImportName, rawSecureValuePackage)

	err := filepath.Walk(pkgDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !strings.HasSuffix(path, "_gen.go") {
			return nil
		}

		fmt.Printf("* Processing file %s\n", path)

		return processFile(path, typeToReplace)
	})
	if err != nil {
		fmt.Printf("Error walking directory: %v\n", err)
		os.Exit(1)
	}
}

func processFile(filePath, typeToReplace string) error {
	fset := token.NewFileSet()

	f, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("error parsing file %s: %w", filePath, err)
	}

	madeReferenceToExtPackage := false

	astutil.Apply(f, func(cursor *astutil.Cursor) bool {
		switch c := cursor.Node().(type) {
		case *ast.TypeSpec:
			if c.Name.String() == typeToReplace {
				cursor.Delete()
			}

		case *ast.Field:
			if ident, ok := c.Type.(*ast.Ident); ok && ident.Name == typeToReplace {
				ident.Name = typeImportName
				cursor.Replace(c)
				madeReferenceToExtPackage = true
			}

			if ptr, ok := c.Type.(*ast.StarExpr); ok {
				if ident, ok := ptr.X.(*ast.Ident); ok && ident.Name == typeToReplace {
					ident.Name = typeImportName
					cursor.Replace(c)
					madeReferenceToExtPackage = true
				}
			}
		}

		return true
	}, nil)

	if madeReferenceToExtPackage && !astutil.AddNamedImport(fset, f, rawSecureValuePackageAlias, rawSecureValuePackage) {
		return fmt.Errorf("error adding import %s", rawSecureValuePackage)
	}

	if err := writeFile(filePath, fset, f); err != nil {
		return fmt.Errorf("error writing file %s: %w", filePath, err)
	}

	return nil
}

func writeFile(filePath string, fset *token.FileSet, node *ast.File) error {
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("error opening file %s: %w", filePath, err)
	}

	defer func() { _ = file.Close() }()

	if err := format.Node(file, fset, node); err != nil {
		return fmt.Errorf("error formatting file %s: %w", filePath, err)
	}

	return nil
}
