package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
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
	repoAbsPath, err := filepath.Abs("../../pkg/build/npm")
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
	fset := token.NewFileSet()
	filemap, err := parser.ParseDir(fset, repoAbsPath, nil, parser.ImportsOnly)
	if err != nil {
		fmt.Println(err)
	}

	// loop over elements of slice
	for p, ast := range filemap {

		// m is a map[string]interface.
		// loop over keys and values in the map.

		fmt.Println("KEY FROM FILEMAP", p)
		fmt.Println("VALUE FROM FILEMAP", ast)
		// print out the files in the map: name and their imports

		for filename, fileobj := range ast.Files {
			// ast.Files bunch of file objects in build directory
			fmt.Println("filename from ast.Files", filename)

			for _, curImport := range fileobj.Imports {
				// j, _ := json.MarshalIndent(curImport, "", "")
				// fmt.Println(string(j))
				fmt.Println("curImport.Path.Value", curImport.Path.Value)
			}

		}
	}

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

	// Visit function to check each Go file in the repository
	// visit := func(path string, info os.DirEntry, err error) error {
	// 	if err != nil {
	// 		return err
	// 	}

	// 	// Check if the file is a Go file
	// 	if !info.IsDir() && strings.HasSuffix(info.Name(), ".go") {
	// 		// Parse the Go file
	// 		fset := token.NewFileSet()
	// 		file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
	// 		if err != nil {
	// 			return err
	// 		}

	// 		// Check if the file imports any of the modules' names
	// 		for _, importSpec := range file.Imports {
	// 			importPath := strings.Trim(importSpec.Path.Value, "\"")
	// 			if importedPackages[importPath] {
	// 				importingFiles = append(importingFiles, path)
	// 				break
	// 			}
	// 		}
	// 	}

	// 	return nil
	// }
	fmt.Println("I AM AFTER VISIT")

	// Walk through the repository directory and its subdirectories
	// err = filepath.WalkDir(repoAbsPath, visit)
	// fmt.Println("I AM WALKDIR ERR", err)
	// if err != nil {
	// 	return nil, err
	// }

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
