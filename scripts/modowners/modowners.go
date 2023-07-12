package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"strings"

	"golang.org/x/mod/modfile"
	"os"
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
// An example CLI command is `go run scripts/modowners/modowners.go check go.mod`
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

// TODO: test with go test
// Print owner(s) for a given dependency.
// An example CLI command is `go run scripts/modowners/modowners.go owners -c go.mod github.com/Azure/go-autorest/autorest`
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

// Print dependencies for a given owner. Can specify one or more owners.
// Example CLI command `go run scripts/modowners/modowners.go modules -m go.mod -o @as-code,@delivery`
func modules(fileSystem fs.FS, logger *log.Logger, args []string) error {
	fs := flag.NewFlagSet("modules", flag.ExitOnError)
	indirect := fs.Bool("i", false, "print indirect dependencies")
	modfile := fs.String("m", "go.mod", "use specified modfile")
	owner := fs.String("o", "", "one or more owners")
	fs.Parse(args)
	m, err := parseGoMod(fileSystem, *modfile)
	if err != nil {
		return err
	}

	ownerFlags := strings.Split(*owner, ",")
	for _, mod := range m {
		// If there are owner flags or modfile's dependency has an owner to compare
		// Else if -i is present and current dependency is indirect
		if len(*owner) > 0 && hasCommonElement(mod.Owners, ownerFlags) {
			logger.Println(mod.Name)
		} else if *indirect || !mod.Indirect {
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
	log.SetFlags(0)
	log.SetOutput(os.Stdout)
	if len(os.Args) < 2 {
		fmt.Println("usage: modowners subcommand go.mod...")
		os.Exit(1)
	}
	type CmdFunc func(fs.FS, *log.Logger, []string) error
	cmds := map[string]CmdFunc{"check": check, "owners": owners, "modules": modules}
	if f, ok := cmds[os.Args[1]]; !ok {
		log.Fatal("invalid command")
	} else if err := f(os.DirFS("."), log.Default(), os.Args[2:]); err != nil {
		log.Fatal(err)
	}
}
