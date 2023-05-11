package main

import (
	"errors"
	"flag"
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

func check(args []string) error {
	m, err := parseGoMod(args[0])
	if err != nil {
		return err // NOTE: propogating the error upwards
	}
	fail := false
	for _, mod := range m {
		if mod.Indirect == false && len(mod.Owners) == 0 {
			fmt.Println(mod.Name)
			fail = true
		}
	}
	if fail {
		return errors.New("modfile is invalid") // NOTE: simple way to return errors
	}
	return nil
}

// TODO: owners and modules may optionally take a list (modules for owners, owners for modules)
// TODO: test with go test

func owners(args []string) error {
	fs := flag.NewFlagSet("owners", flag.ExitOnError)
	count := fs.Bool("c", false, "print count of dependencies per owner")
	fs.Parse(args)
	m, err := parseGoMod(fs.Arg(0))
	if err != nil {
		return err
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
		if *count {
			fmt.Println(owner, n)
		} else {
			fmt.Println(owner)
		}
	}
	return nil
}

func modules(args []string) error {
	fs := flag.NewFlagSet("modules", flag.ExitOnError)
	indirect := fs.Bool("i", false, "print indirect dependencies") // NOTE: indirect is a pointer bc we dont want to lose value after changing it
	modfile := fs.String("m", "go.mod", "use specified modfile")
	owner := fs.String("o", "", "one or more owners")
	fs.Parse(args)
	m, err := parseGoMod(*modfile) // NOTE: give me the string that's the first positional argument; fs.Arg works only after fs.Parse
	if err != nil {
		return err
	}
	/*
		GOAL:
		1. if no flags, print all direct dependencies
		2. if -i, print all dependencies (direct + indirect)
		3. if -o, print dependencies owned by the owner(s) listed
		4. if -i and -o, print all dependencies owned by the owner(s) listed

		print all dependencies for each owner listed in CLI after -o flag
		check each dependency's owners

			if it match one of the owners in the flag/CLI, print it
			if not skip

		CURRENT ISSUE:
		owner flag logic not working well with indirect flag logic
		not sure how to check for both flags

		mod.Owners := [bep, as-code, delivery]
		flag := [gaas, delivery]
	*/

	for _, mod := range m {
		ownerFlags := strings.Split(*owner, ",")
		// If there are owner flags
		if len(*owner) > 0 {
			// Confirm in the modfile's dependency has an owner to compare
			if len(mod.Owners) > 0 && hasCommonElement(mod.Owners, ownerFlags) {
				fmt.Println(mod.Name)
			}
		}
		// NOTE: if the indirect flag is used OR if dependency is direct; if indirect flag is used print all dependencies or if flga isn't used, print direct dependencies
		if *indirect || !mod.Indirect {
			fmt.Println(mod.Name)
		}
	}
	return nil
}

func hasCommonElement(a []string, b []string) bool {
	for _, u := range a {
		for _, v := range b {
			if u == v {
				return true
			}
		}
	}
	return false
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: modowners subcommand go.mod...")
		os.Exit(1)
	}
	cmds := map[string]func([]string) error{"check": check, "owners": owners, "modules": modules}
	if f, ok := cmds[os.Args[1]]; !ok { // NOTE: both f and ok are visible inside the if / else if statement, but not outside; chaining of ifs very common in go when checking errors and calling multiple funcs
		log.Fatal("invalid command")
	} else if err := f(os.Args[2:]); err != nil {
		log.Fatal(err)
	}
}
