package testutil

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func PrettyPrint(label string, i interface{}) {
	b, err := json.MarshalIndent(i, "", "  ")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println(label, string(b))
}

// FindJSONFiles recursively finds all .json files in a directory
func FindJSONFiles(dir string) ([]string, error) {
	var jsonFiles []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".json") {
			jsonFiles = append(jsonFiles, path)
		}
		return nil
	})

	return jsonFiles, err
}

// GetRelativeOutputPath converts an input path to a relative output path preserving directory structure
func GetRelativeOutputPath(inputPath, inputDir string) string {
	// Get the relative path from the input directory
	relPath, err := filepath.Rel(inputDir, inputPath)
	if err != nil {
		// If we can't get relative path, just use the filename
		return filepath.Base(inputPath)
	}
	// Preserve the directory structure
	return relPath
}
