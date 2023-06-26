package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"log"
	"path/filepath"
	"strconv"
	"strings"
)

// Confirm if given directory contains given import
// Example CLI command `go run scripts/modowners/modowners_generation_script.go xorm.io/core`
func hasImport(dir, importName string) (bool, error) {
	// Get the absolute path to the repository
	repoAbsPath, err := filepath.Abs(dir)
	if err != nil {
		return false, err
	}

	// Find what files are in specified repo
	fset := token.NewFileSet()
	packages, err := parser.ParseDir(fset, repoAbsPath, nil, parser.ImportsOnly)
	if err != nil {
		return false, fmt.Errorf("failed to parse directory: %w", err)
	}

	// Iterate over parsed packages and their files
	for _, pkg := range packages {
		for _, file := range pkg.Files {
			// Check if the file imports the specified package
			for _, imp := range file.Imports {
				importPath, err := strconv.Unquote(imp.Path.Value)
				if err != nil {
					log.Printf("Failed to unquote import path %s: %v\n", imp.Path.Value, err)
					continue
				}
				if strings.Contains(importPath, importName) {
					return true, nil
				}
			}
		}
	}

	return false, nil
}

// func main() {
// 	// Iterate recursively through directories
// 	err := filepath.WalkDir(".", func(path string, d fs.DirEntry, err error) error {
// 		if !d.IsDir() {
// 			return nil
// 		}
// 		contains, err := hasImport(path, os.Args[1])
// 		if err != nil {
// 			return err
// 		}
// 		if contains {
// 			fmt.Println(path)
// 		}
// 		return nil
// 	})

// 	if err != nil {
// 		log.Fatal(err)
// 	}
// }
