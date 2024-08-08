package main

import (
	"flag"
	"fmt"
	"os"

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
	help := fs.Bool("help", false, "Print help message")
	fs.Parse(os.Args[2:])
	if *help {
		fs.Usage()
		return nil
	}
	workfile, err := parseGoWork(*workPath)
	if err != nil {
		return err
	}
	paths := getSubmodulePaths(workfile)
	for _, p := range paths {
		fmt.Printf("%s%s", p, *delimiter)
	}
	return nil
}

func getSubmodulePaths(wf *modfile.WorkFile) []string {
	var paths []string
	for _, d := range wf.Use {
		paths = append(paths, d.Path)
	}
	return paths
}

func parseGoWork(p string) (*modfile.WorkFile, error) {
	contents, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}

	return modfile.ParseWork(p, contents, nil)
}
