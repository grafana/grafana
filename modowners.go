package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"golang.org/x/mod/modfile"
)

type Module struct {
	Name     string
	Owners   []string
	Indirect bool
}

func parseModule(mod *modfile.Require) Module {
	// New Module struct
	m := Module{Name: mod.Mod.String()}

	// For each require, access the comment
	for _, comment := range mod.Syntax.Comments.Suffix {
		owners := strings.Fields(comment.Token)
		// For each comment, determine if it contains an owner(s)
		for _, owner := range owners {
			if strings.Contains(owner, "indirect") {
				m.Indirect = true
			}
			// If an owner, add to owners list
			if strings.Contains(owner, "@") {
				m.Owners = append(m.Owners, owner)
			}
		}
	}
	return m
}

func parseGoMod(name string) ([]Module, error) {
	// Turn go.mod into array of bytes
	data, err := os.ReadFile(name)
	if err != nil {
		return nil, err
	}

	// Parse modfile
	modFile, err := modfile.Parse(name, data, nil)
	if err != nil {
		return nil, err
	}
	modules := []Module{}
	// Iterate through requires in modfile
	for _, mod := range modFile.Require {
		m := parseModule(mod)
		modules = append(modules, m)
	}
	return modules, nil
}

func main() {
	if len(os.Args) < 3 {
		fmt.Println("usage: modowners subcommand go.mod...")
		os.Exit(1)
	}
	switch os.Args[1] {
	case "check":
		m, err := parseGoMod(os.Args[2])
		if err != nil {
			log.Fatal(err)
		}
		fail := false
		for _, mod := range m {
			if mod.Indirect == false && len(mod.Owners) == 0 {
				fmt.Println(mod.Name)
				fail = true
			}
		}
		if fail {
			os.Exit(1)
		}
	case "owners": // Print owners for specific dependency(s)
		// TODO: enhance to take list of modules (specific one, two, or etc)
		// TODO: have indirect flag that prints indirect

		// TODO: owners and modules may optionally take a list (modules for owners, owners for modules)
		// TODO: introduce help messages
		// TODO: test with go test
		// TODO: move every subcommand into its own func to keep main small
		m, err := parseGoMod(os.Args[2])
		if err != nil {
			log.Fatal(err)
		}
		owners := map[string]int{}
		for _, mod := range m {
			if mod.Indirect == false {
				for _, owner := range mod.Owners {
					owners[owner]++
				}
			}
		}
		for owner, n := range owners {
			fmt.Println(owner, n)
		}

	case "modules": // Print all direct dependencies
		// TODO: optionally print the count
		m, err := parseGoMod(os.Args[2])
		if err != nil {
			log.Fatal(err)
		}
		for _, mod := range m {
			if mod.Indirect == false {
				fmt.Println(mod.Name)
			}
		}
	default:
		os.Exit(1)
	}
}
