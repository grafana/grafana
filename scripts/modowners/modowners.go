package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
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
	m := Module{Name: mod.Mod.String()}

	// For each require, access the comment.
	for _, comment := range mod.Syntax.Comments.Suffix {
		owners := strings.Fields(comment.Token)
		// For each comment, determine if it contains owner(s).
		for _, owner := range owners {
			if strings.Contains(owner, "indirect") {
				m.Indirect = true
			}
			// If there is an owner, add to owners list.
			if strings.Contains(owner, "@") {
				m.Owners = append(m.Owners, owner)
			}
		}
	}
	return m
}

func parseGoMod(fileSystem fs.FS, name string) ([]Module, error) {
	file, err := fileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Turn modfile into array of bytes.
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// Parse modfile.
	modFile, err := modfile.Parse(name, data, nil)
	if err != nil {
		return nil, err
	}

	modules := []Module{}

	// Iterate through requires in modfile.
	for _, mod := range modFile.Require {
		m := parseModule(mod)
		modules = append(modules, m)
	}
	return modules, nil
}

// Validate that each module has an owner.
// An example CLI command is `go run dummy/modowners.go check dummy/go.txd`
// TODO: replace above example with final filepath in the end
func check(fileSystem fs.FS, logger *log.Logger, args []string) error {
	m, err := parseGoMod(fileSystem, args[0])
	if err != nil {
		return err
	}
	fail := false
	for _, mod := range m {
		if !mod.Indirect && len(mod.Owners) == 0 {
			logger.Println(mod.Name)
			fail = true
		}
	}
	if fail {
		return errors.New("modfile is invalid")
	}
	return nil
}

// TODO: owners and modules may optionally take a list (modules for owners, owners for modules)
// TODO: test with go test
// Print owners.
func owners(fileSystem fs.FS, logger *log.Logger, args []string) error {
	fs := flag.NewFlagSet("owners", flag.ExitOnError)
	count := fs.Bool("c", false, "print count of dependencies per owner")
	fs.Parse(args)
	m, err := parseGoMod(fileSystem, fs.Arg(0))
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

// Print dependencies. Can specify direct / multiple owners.
// Example CLI command `go run dummy/modowners.go modules -m dummy/go.txd -o @as-code,@delivery`
func modules(fileSystem fs.FS, logger *log.Logger, args []string) error {
	fs := flag.NewFlagSet("modules", flag.ExitOnError)
	indirect := fs.Bool("i", false, "print indirect dependencies") // NOTE: indirect is a pointer bc we dont want to lose value after changing it
	modfile := fs.String("m", "go.txd", "use specified modfile")
	owner := fs.String("o", "", "one or more owners")
	fs.Parse(args)
	m, err := parseGoMod(fileSystem, *modfile) // NOTE: give me the string that's the first positional argument; fs.Arg works only after fs.Parse
	if err != nil {
		return err
	}

	ownerFlags := strings.Split(*owner, ",")
	for _, mod := range m {
		// If there are owner flags or modfile's dependency has an owner to compare
		// Else if -i is present and current dependency is indirect
		if len(*owner) > 0 && hasCommonElement(mod.Owners, ownerFlags) {
			logger.Println(mod.Name)
		} else if *indirect && !mod.Indirect {
			logger.Println(mod.Name)
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
	type CmdFunc func(fs.FS, *log.Logger, []string) error
	cmds := map[string]CmdFunc{"check": check, "owners": owners, "modules": modules}
	if f, ok := cmds[os.Args[1]]; !ok { // NOTE: both f and ok are visible inside the if / else if statement, but not outside; chaining of ifs very common in go when checking errors and calling multiple funcs
		log.Fatal("invalid command")
	} else if err := f(os.DirFS("."), log.Default(), os.Args[2:]); err != nil {
		log.Fatal(err)
	}
}
