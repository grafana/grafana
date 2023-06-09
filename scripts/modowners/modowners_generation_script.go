package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
)

// input: module name, output: list of files that import it
// how??
func getFiles(modules []Module) (map[string][]string, error) {
	fmt.Println("I AM GET FILES")

	// Path to the Grafana repository
	repoPath := "github.com/grafana/grafana"

	// Get the absolute path to the repository
	repoAbsPath, err := filepath.Abs("../../pkg/build/npm")
	if err != nil {
		return nil, err
	}

	fmt.Println("repoPath", repoPath)
	fmt.Println("repoAbsPath", repoAbsPath)

	// // List of importing files
	// importingFiles := make([]string, 0)

	// Map to store imported files for each module
	importedFiles := make(map[string][]string)

	for _, module := range modules {
		importedFiles[module.Name] = []string{}
	}
	fmt.Println("I AM BEFORE VISIT")

	// Find what files are in specified repo
	fset := token.NewFileSet()
	filemap, err := parser.ParseDir(fset, repoAbsPath, nil, parser.ImportsOnly)
	if err != nil {
		fmt.Println(err)
	}

	for importName, _ := range importedFiles {
		// loop over elements of slice
		// filemap is a map where key is what pkg we're in and value is ask.Package, which has info about a package obtained via parsing it's go source files
		for p, ast := range filemap {

			// m is a map[string]interface.
			// loop over keys and values in the map.

			fmt.Println("KEY FROM FILEMAP, aka what pkg are we in", p)
			fmt.Println("VALUE FROM FILEMAP", ast)
			// print out the files in the map: name and their imports

			for filename, fileobj := range ast.Files {
				// ast.Files is a map of file objects in build directory
				// filename is the absolute path to the repoAbsPath
				fmt.Println("filename from ast.Files", filename)

				for _, curImport := range fileobj.Imports {
					// j, _ := json.MarshalIndent(curImport, "", "")
					// fmt.Println(string(j))
					fmt.Println("curImport.Path.Value", curImport.Path.Value)
					if curImport.Path.Value == importName {
						importedFiles[importName] = append(importedFiles[importName], filename) // NOTE: i dont think filename is what we want - it looks like /Users/kat/grafana/grafana/pkg/build/npm/npm.go
					}

				}

			}
		}
	}
	fmt.Println("importedFiles", importedFiles)
	fmt.Println("FILEMAP", filemap)

	/*
		see if i can iterate through the file structure
		think about: what do we ultimately want to reutrn form this func: map
			map where key is import name and value is []string of files the import is in

		insantiate an empty map that i can use as a result that i return
			intead of logging what we just logged, changed the code to add it to that map


		only step left is i need to iterate over all the directories

		change the path that we're parsing now to the pkg directory
		need to be a line of code to find all the subdirectories
		recursviely do it until i run out of subdirectories

		-- big picture --
		first find all subdirectories and make a list of paths
		for each path, call the code that we have now

		keep the result set outside and keep appending to it

		--
		just parsing one directory, not parsing subfolders
			going to src/build, grabbing all the .go files, putting the filename as the key, parsing the file and biulding the AST obj and putting tht as value

			directory given as key
			value:


			ask serge!!: bc you're allowed pointers, other languages do concrete data structures.
			{
			FileName: asd, Parent Directory: { path: /src, Files: [{FileName: asd}]
			}
	*/

	return importedFiles, nil
}

func main() {
	// parse go.mod to get list of modules
	m, _ := parseGoMod(os.DirFS("."), "go.mod")
	// if err != nil {
	// 	return nil, err
	// }

	files, _ := getFiles(m)
	// if err != nil {
	// 	return nil, err
	// }
	fmt.Println("FILES FROM MAIN", files)

}
