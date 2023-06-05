package main

import (
	"testing"
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
*/
func TestGetFiles(t *testing.T) {
	for _, test := range []struct {
		moduleName     string
		expectedResult []string
	}{
		{"test1.mod", []string{"file1.go", "file2.go", "file3.go"}},
		{"test2.mod", []string{"file4.go"}},
		{"test3.mod", []string{"file5.go", "file6.go", "file7.go", "file8.go"}},
	} {
		result, err := getFiles(test.moduleName)
		if err != nil {
			t.Error("error getting files", err)
		}
		// Compare each file in the result and expected slices
		for i := range result {
			if result[i] != test.expectedResult[i] {
				t.Errorf("Expected file '%s', but got file '%s'", test.expectedResult[i], result[i])
			}
		}
	}
}
