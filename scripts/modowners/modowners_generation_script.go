package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

/*
load in the modules
	for each module, call func that takes in module name and return list of files
	with list of files, call func that takes in list of files, returns presumed owner (single team name)
	modify modfile, write it back out (should be straightfwd) modfile.AddComment
		need to write it back to my filesystem as go.mod.altered, compare to go.mod, raise the PR

create folder called testdata
test files in the folder
whatever i want to do with this func, i do it with test data - return to the test
encourages me to write thing func so it doesnt print to stdoutput and parse from OS, rather send it io.Reader with w/e go.mod file and return either io.Writer or
call thing()
*/

// input: module name, output: list of files that import it
// how??
func getFiles(modules []Module) ([]string, error) {
	fmt.Println("I AM GET FILES")

	// Path to the Grafana repository
	repoPath := "github.com/grafana/grafana"

	// Get the absolute path to the repository
	repoAbsPath, err := filepath.Abs("")
	if err != nil {
		return nil, err
	}

	fmt.Println("repoPath", repoPath)
	fmt.Println("repoAbsPath", repoAbsPath)

	// List of importing files
	importingFiles := make([]string, 0)

	// Set to store unique imported packages
	importedPackages := make(map[string]bool)

	for _, module := range modules {
		importedPackages[module.Name] = true
	}
	fmt.Println("I AM BEFORE VISIT")

	// Visit function to check each Go file in the repository
	visit := func(path string, info os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Check if the file is a Go file
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".go") {
			// Parse the Go file
			fset := token.NewFileSet()
			file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if err != nil {
				return err
			}

			// Check if the file imports any of the modules' names
			for _, importSpec := range file.Imports {
				importPath := strings.Trim(importSpec.Path.Value, "\"")
				if importedPackages[importPath] {
					importingFiles = append(importingFiles, path)
					break
				}
			}
		}

		return nil
	}
	fmt.Println("I AM AFTER VISIT")

	// Walk through the repository directory and its subdirectories
	err = filepath.WalkDir(repoAbsPath, visit)
	fmt.Println("I AM WALKDIR ERR", err)
	if err != nil {
		return nil, err
	}

	fmt.Println("FILES FROM GETFILES", importingFiles)

	return importingFiles, nil

	// for each module, return a list of files that import it
	// DO NOW: determine how to get list of files that import a module based on module name
}

func main() {
	// parse go.mod to get list of modules
	m, _ := parseGoMod(os.DirFS("."), "go.mod")
	// if err != nil {
	// 	return nil, err
	// }

	// for each direct module, get list of files that import it
	// for _, mod := range m {
	// 	if mod.Indirect == false {
	// 		_, err := getFiles(mod)
	// 		fmt.Println(mod)
	// 		if err != nil {
	// 			// return nil, err
	// 		}
	// 	}
	// }

	files, _ := getFiles(m)
	// if err != nil {
	// 	return nil, err
	// }
	fmt.Println("FILES FROM MAIN", files)
}
