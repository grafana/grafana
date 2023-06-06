package main

import (
	"fmt"
	"os"
)

/*
load in the modules
	for each module, call func that takes in module name and return list of files
	with list of files, call func that takes in list of files, returns presumed owner (single team name)
	modify modfile, write it back out (should be straightfwd) modfile.AddComment
		need to write it back to my filesystem as go.mod.altered, compare to go.mod, raise the PR


write new output to test_go.mod so i can compare and make sure it's valid
	when i want to raise pr, copy test_go.mod and paste into go.mod

dont worry about if things are in the right place

create folder called testdata
test files in the folder
whatever i want to do with this func, i do it with test data - return to the test
encourages me to write thing func so it doesnt print to stdoutput and parse from OS, rather send it io.Reader with w/e go.mod file and return either io.Writer or
call thing()

best way to test things is usually to use test functions, and not the main func
no diff b/n test func and main func
*/

// input: module name, output: list of files that import it
// how??
func getFiles(moduleName string) ([]string, error) {
	fmt.Println("I AM GET FILES")

	// for each module, return a list of files that import it
	// DO NOW: determine how to get list of files that import a module based on module name

	return []string{}, nil
}

func main() {
	// parse go.mod to get list of modules
	m, err := parseGoMod(os.DirFS("."), "go.mod")
	if err != nil {
		return nil, err
	}

	// for each direct module, get list of files that import it
	for _, mod := range m {
		if mod.Indirect == false {
			files, err := getFiles(mod)
			fmt.Println(mod)
			if err != nil {
				return nil, err
			}
		}
	}

}
