package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// input: import name, output: list of files that import it
func getFiles(importName string) ([]string, error) {
	var importingFiles []string

	// Get the absolute path to the repository
	repoAbsPath, err := filepath.Abs("")
	if err != nil {
		return nil, err
	}

	fmt.Println("repoAbsPath", repoAbsPath)

	// Find what files are in specified repo
	fset := token.NewFileSet()
	packages, err := parser.ParseDir(fset, repoAbsPath, nil, parser.ImportsOnly)
	if err != nil {
		return nil, fmt.Errorf("failed to parse directory: %w", err)
	}
	fmt.Println("packages", packages)
	// Iterate over parsed packages and their files
	for _, pkg := range packages {
		fmt.Println("pkg", pkg)
		for _, file := range pkg.Files {
			// Check if the file imports the specified package
			for _, imp := range file.Imports {
				importPath, err := strconv.Unquote(imp.Path.Value)
				if err != nil {
					log.Printf("Failed to unquote import path %s: %v\n", imp.Path.Value, err)
					continue
				}
				fmt.Printf("importPath is %s, importName is %s", importPath, importName)
				if strings.Contains(importPath, importName) {
					importingFiles = append(importingFiles, fset.Position(file.Pos()).Filename)
					break
				}
			}
		}
	}

	fmt.Println("importingFiles", importingFiles)

	return importingFiles, nil
}

func main() {
	fmt.Println("os.Args", os.Args[1])
	files, err := getFiles(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("files from getFiles", files)

}
