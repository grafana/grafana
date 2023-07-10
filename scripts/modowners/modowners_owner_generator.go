package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
)

func main() {
	// Read the file contents
	filePath := "../../owners.txt"
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Failed to read file: %s\n", err)
		return
	}

	// Convert byte slice of file contents to string
	fileString := string(content)

	// Split the file string into lines
	lines := strings.Split(fileString, "\n")

	// Create a map to store import names and team names
	ownersMap := make(map[string]string)

	// Process each line
	for _, line := range lines {
		// Skip empty lines
		if line == "" {
			continue
		}

		// Split the line into import name and team name
		parts := strings.Split(line, " ")
		if len(parts) < 2 {
			fmt.Printf("Invalid line: %s\n", line)
			continue
		}

		importName := parts[0]
		teamName := parts[1]

		// Store the import name and team name in the map
		ownersMap[importName] = teamName
	}

	// Print the map
	for importName, teamName := range ownersMap {
		fmt.Printf("Import: %s, Team: %s\n", importName, teamName)
	}

	// TODO: parse go.mod, find current module in ownersMap, if doesn't currently have an owner, append owner to the comment

	// Get relative path to root directory
	curDir, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	rootDir := strings.Replace(curDir, "/scripts/modowners", "", -1)
	m, err := parseGoMod(os.DirFS(rootDir), "go.mod")

	if err != nil {
		log.Fatal(err)
	}

	// Iterate over modules, look up current mod name in ownersMap, append owner as comment
	for _, mod := range m {
		if mod.Name == ownersMap[mod.Name] {
			// append ownersMap[mod.Name] to comment
		}
	}
	fmt.Println("m", m)
}
