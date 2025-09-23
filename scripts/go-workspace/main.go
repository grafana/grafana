package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"golang.org/x/mod/modfile"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "list-submodules":
		err = listSubmodules()
	case "validate-dockerfile":
		err = validateDockerfile()
	default:
		printUsage()
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage() {
	println("Usage: go-workspace <command> [args]")
	println("Commands:")
	println("  list-submodules - List submodules in go.work")
}

func listSubmodules() error {
	fs := flag.NewFlagSet("list-submodules", flag.ExitOnError)
	workPath := fs.String("path", "go.work", "Path to go.work")
	delimiter := fs.String("delimiter", "\n", "Delimiter to use when printing paths")
	skip := fs.String("skip", "", "Skip submodules with this comment tag")
	help := fs.Bool("help", false, "Print help message")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}

	if *help {
		fs.Usage()
		return nil
	}

	workfile, err := parseGoWork(*workPath)
	if err != nil {
		return err
	}

	paths := getSubmodulePaths(workfile, *skip)
	for _, p := range paths {
		fmt.Printf("%s%s", p, *delimiter)
	}

	return nil
}

func validateDockerfile() error {
	fs := flag.NewFlagSet("validate-dockerfile", flag.ExitOnError)
	workPath := fs.String("path", "go.work", "Path to go.work")
	dockerfilePath := fs.String("dockerfile-path", "Dockerfile", "Path to Dockerfile")
	skip := fs.String("skip", "", "Skip submodules with this comment tag")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}

	dockerFileRaw, err := os.ReadFile(*dockerfilePath)
	if err != nil {
		return err
	}
	dockerFile := string(dockerFileRaw)

	workfile, err := parseGoWork(*workPath)
	if err != nil {
		return err
	}

	paths := getSubmodulePaths(workfile, *skip)
	for _, p := range paths {
		path := strings.TrimPrefix(p, "./")
		if path == "" || path == "." {
			continue
		}
		if !strings.Contains(dockerFile, path) {
			return fmt.Errorf("the Dockerfile is missing `COPY %s/go.* %s` for the related module. Please add it and commit the change.", path, path)
		}
	}

	fmt.Println("All submodules are included in the Dockerfile.")
	return nil
}

func getSubmodulePaths(wf *modfile.WorkFile, skip string) []string {
	var paths []string
	for _, d := range wf.Use {
		if hasSkipTag(d, skip) {
			continue
		}
		paths = append(paths, d.Path)
	}
	return paths
}

func hasSkipTag(d *modfile.Use, tag string) bool {
	if tag == "" {
		return false
	}
	for _, c := range d.Syntax.Comments.Suffix {
		if strings.Contains(c.Token, fmt.Sprintf("skip:%s", tag)) {
			return true
		}
	}
	return false
}

func parseGoWork(p string) (*modfile.WorkFile, error) {
	contents, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}

	return modfile.ParseWork(p, contents, nil)
}
