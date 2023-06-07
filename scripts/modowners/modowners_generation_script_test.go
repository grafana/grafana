package main

import (
	"testing"
)

/*
question: how do i mock files that import the below 3 imports and use said imports?
*/
func TestGetFiles(t *testing.T) {
	for _, test := range []struct {
		moduleName     string
		expectedResult []string
	}{
		{"cloud.google.com/go/storage v1.28.1", []string{"file1.go", "file2.go", "file3.go"}},
		{"cuelang.org/go v0.5.0", []string{"file4.go"}},
		{"github.com/Azure/azure-sdk-for-go v65.0.0+incompatible", []string{"file2.go", "file4.go", "file5.go"}},
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
