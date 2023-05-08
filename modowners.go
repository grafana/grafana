package main

import (
	"fmt"
	"log"
	"os"
	"strings"

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

	// Parse modfile
	modFile, err := modfile.Parse("", data, nil)
	if err != nil {
		log.Fatalf("failed to parse modfile: %s", err)
	}

	// New Module struct
	m := Module{}

	// Flag to track if dependency is indirect
	flag := false
	fmt.Println("flag", flag) // QUESTION: including this line for now because if i comment this out, i get compile warning "flag declared but not used" - how come?

	// Iterate through requires in modfile
	for _, require := range modFile.Require {
		// For each require, access the comment
		for _, comment := range require.Syntax.Comments.Suffix {
			owners := strings.Fields(comment.Token)
			// For each comment, determine if it contains an owner(s)
			for _, owner := range owners {
				// Break if dependency is indirect
				if strings.Contains(owner, "indirect") {
					flag = true // QUESTION: why do we need flag if we're breaking anyway?
					break
				}
				// If an owner, add to owners list
				if strings.Contains(owner, "@") {
					if !strings.Contains(strings.Join(m.Owners, " "), owner) { // QUESTION: this `strings.Join(m.Owners, " ")` doesn't change the original m.Owners, right?
						m.Owners = append(m.Owners, owner)
					}
				}
			}
		}
	}
	fmt.Println("owners: ", m.Owners)
}
