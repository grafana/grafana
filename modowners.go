package main

import (
	"fmt"
	"log"
	"os"

	"golang.org/x/mod/modfile"
)

type Module struct {
	Name   string
	Owners []string
}

// TODO: figure out how to return the parsed modfile as a []Module
// func ParseGoMod() ([]Module, error) {
// 	// Turn go.mod into array of bytes
// 	data, err := os.ReadFile("dummy/go.mod")
// 	if err != nil {
// 		log.Fatalf("failed to read file: %s", err)
// 	}
// 	fmt.Printf("Contents of go.mod file:\n%s\n", string(data))

// 	// Parse modfile
// 	modFile, err := modfile.Parse("", data, nil)
// 	if err != nil {
// 		log.Fatalf("failed to parse modfile: %s", err)
// 	}

// 	// TODO: remove this
// 	fmt.Println("MODFILE", modFile.Module.Mod.Path)

// 	return modFile, error
// }

func main() {
	// Turn go.mod into array of bytes
	data, err := os.ReadFile("dummy/go.mod")
	if err != nil {
		log.Fatalf("failed to read file: %s", err)
	}
	fmt.Printf("Contents of go.mod file:\n%s\n", string(data))

	// Parse modfile
	modFile, err := modfile.Parse("", data, nil)
	if err != nil {
		log.Fatalf("failed to parse modfile: %s", err)
	}

	// TODO: remove this
	fmt.Println("MODFILE", modFile.Module.Mod.Path)

	// Iterate through requires in modfile
	for _, require := range modFile.Require {
		// For each require, print the comment suffix
		for _, comment := range require.Syntax.Comments.Suffix {
			// For each comment, determine if it's an owner (contains an @)
			for _, owner := range comment {
				// If yes add to owners list; ignore if implicit
				// Use boolean flag to see if it’s implicit or not, initially assume module is explicit, unless i find a comment that includes implicit word, then change flag to implicit

			}
			fmt.Println("comment: ", comment)
		}
	}
}
