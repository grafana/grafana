//go:build ignore
// +build ignore

package main

import (
	"context"
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"fmt"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
	"io/fs"
	"os"
	"path/filepath"
)

var CoreDefParentPath = "kinds"

//go:generate go run cog_gen.go

func main() {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}
	groot := filepath.Dir(cwd)
	dir := filepath.Join(groot, CoreDefParentPath)

	var kindDirs []string
	err = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() && d.Name() != CoreDefParentPath {
			rel := filepath.Join("../", CoreDefParentPath, d.Name())
			kindDirs = append(kindDirs, rel)
		}

		return nil
	})

	input := codegen.DataForGen{
		Kind:     "core",
		Files:    kindDirs,
		CueFiles: loadCueFiles(kindDirs),
	}

	jennies := codejen.JennyListWithNamer(func(t codegen.DataForGen) string {
		return "CogGen"
	})

	jennies.Append(
		&codegen.K8ResourcesJenny{},
		&codegen.GoTypesJenny{},
		&codegen.TSResources{},
	)

	header := codegen.SlashHeaderMapper("kinds/cog_gen.go")
	jennies.AddPostprocessors(header)

	fs, err := jennies.GenerateFS(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error generating files: %s", err)
		os.Exit(1)
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err = fs.Verify(context.Background(), groot); err != nil {
			fmt.Fprintf(os.Stderr, "generated code is out of sync: %s", err)
			os.Exit(1)
		}
	} else if err = fs.Write(context.Background(), groot); err != nil {
		fmt.Fprintf(os.Stderr, "error while writing files: %s", err)
		os.Exit(1)
	}
}

func loadCueFiles(dirs []string) []cue.Value {
	ctx := cuecontext.New()
	values := make([]cue.Value, len(dirs))
	for i, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error opening %s directory: %s", dir, err)
			os.Exit(1)
		}

		// It's assuming that we only have one file in each folder
		entry := filepath.Join(dir, entries[0].Name())
		cueFile, err := os.ReadFile(entry)
		if err != nil {
			fmt.Fprintf(os.Stderr, "unable to open %s/%s file: %s", dir, entries[0].Name(), err)
			os.Exit(1)
		}

		values[i] = ctx.CompileBytes(cueFile)
	}

	return values
}
