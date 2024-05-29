package main

import (
	"context"
	"errors"
	"fmt"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/registry/schemas"
)

var nonAlphaNumRegex = regexp.MustCompile("[^a-zA-Z0-9 ]+")

// main This script verifies that stable kinds are not updated once published (new schemas
// can be added but existing ones cannot be updated).
// It generates kind files into a local "next" folder, ready to be published in the kind-registry repo.
// If kind names are given as parameters, the script will make the above actions only for the
// given kinds.
func main() {
	// File generation
	jfs := codejen.NewFS()
	outputPath := filepath.Join(".github", "workflows", "scripts", "kinds")

	corekinds, err := schemas.GetCoreKinds()
	die(err)

	composableKinds, err := schemas.GetComposableKinds()
	die(err)

	coreJennies := codejen.JennyList[schemas.CoreKind]{}
	coreJennies.Append(
		CoreKindRegistryJenny(outputPath),
	)
	corefs, err := coreJennies.GenerateFS(corekinds...)
	die(err)
	die(jfs.Merge(corefs))

	composableJennies := codejen.JennyList[schemas.ComposableKind]{}
	composableJennies.Append(
		ComposableKindRegistryJenny(outputPath),
	)
	composablefs, err := composableJennies.GenerateFS(composableKinds...)
	die(err)
	die(jfs.Merge(composablefs))

	if err = jfs.Write(context.Background(), ""); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}

	if err := copyCueSchemas("packages/grafana-schema/src/common", filepath.Join(outputPath, "next")); err != nil {
		die(fmt.Errorf("error while copying the grafana-schema/common package:\n%s", err))
	}
}

func copyCueSchemas(fromDir string, toDir string) error {
	baseTargetDir := filepath.Base(fromDir)

	return filepath.Walk(fromDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(
			toDir,
			baseTargetDir,
			strings.TrimPrefix(path, fromDir),
		)

		if info.IsDir() {
			return ensureDirectoryExists(targetPath, info.Mode())
		}

		if !strings.HasSuffix(path, ".cue") {
			return nil
		}

		return copyFile(path, targetPath, info.Mode())
	})
}

func copyFile(from string, to string, mode os.FileMode) error {
	input, err := os.ReadFile(from)
	if err != nil {
		return err
	}

	return os.WriteFile(to, input, mode)
}

func ensureDirectoryExists(directory string, mode os.FileMode) error {
	_, err := os.Stat(directory)
	if errors.Is(err, os.ErrNotExist) {
		if err = os.Mkdir(directory, mode); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	return os.Chmod(directory, mode)
}

func die(errs ...error) {
	if len(errs) > 0 && errs[0] != nil {
		for _, err := range errs {
			fmt.Fprint(os.Stderr, err, "\n")
		}
		os.Exit(1)
	}
}

// CoreKindRegistryJenny generates kind files into the "next" folder of the local kind registry.
func CoreKindRegistryJenny(path string) codejen.OneToOne[schemas.CoreKind] {
	return &kindregjenny{
		path: path,
	}
}

type kindregjenny struct {
	path string
}

func (j *kindregjenny) JennyName() string {
	return "KindRegistryJenny"
}

func (j *kindregjenny) Generate(kind schemas.CoreKind) (*codejen.File, error) {
	newKindBytes, err := kindToBytes(kind.CueFile)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(j.path, "next", "core", kind.Name, kind.Name+".cue")
	return codejen.NewFile(path, newKindBytes, j), nil
}

// ComposableKindRegistryJenny generates kind files into the "next" folder of the local kind registry.
func ComposableKindRegistryJenny(path string) codejen.OneToOne[schemas.ComposableKind] {
	return &ckrJenny{
		path: path,
	}
}

type ckrJenny struct {
	path string
}

func (j *ckrJenny) JennyName() string {
	return "ComposableKindRegistryJenny"
}

func (j *ckrJenny) Generate(k schemas.ComposableKind) (*codejen.File, error) {
	name := strings.ToLower(fmt.Sprintf("%s/%s", k.Name, k.Filename))

	v := fixComposableKindFormat(k)

	newKindBytes, err := kindToBytes(v)
	if err != nil {
		return nil, err
	}

	newKindBytes = []byte(fmt.Sprintf("package grafanaplugin\n\n%s", newKindBytes))

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name), newKindBytes, j), nil
}

// kindToBytes converts a kind cue value to a .cue file content
func kindToBytes(kind cue.Value) ([]byte, error) {
	node := kind.Syntax(
		cue.All(),
		cue.Schema(),
		cue.Docs(true),
	)

	return cueformat.Node(node)
}

func fixComposableKindFormat(schema schemas.ComposableKind) cue.Value {
	variant := "PanelCfg"
	if schema.CueFile.LookupPath(cue.ParsePath("composableKinds.DataQuery")).Exists() {
		variant = "DataQuery"
	}

	newCue := schema.CueFile.Context().CompileString(
		fmt.Sprintf("schemaInterface: %q\n", variant) +
			fmt.Sprintf("name: %q + %q\n\n", UpperCamelCase(schema.Name), variant) +
			"lineage: _",
	)

	lineagePath := cue.MakePath(cue.Str("composableKinds"), cue.Str(variant), cue.Str("lineage"))
	return newCue.FillPath(cue.MakePath(cue.Str("lineage")), schema.CueFile.LookupPath(lineagePath))
}

func UpperCamelCase(s string) string {
	s = LowerCamelCase(s)

	// Uppercase the first letter
	if len(s) > 0 {
		s = strings.ToUpper(s[:1]) + s[1:]
	}

	return s
}

func LowerCamelCase(s string) string {
	// Replace all non-alphanumeric characters by spaces
	s = nonAlphaNumRegex.ReplaceAllString(s, " ")

	// Title case s
	s = cases.Title(language.AmericanEnglish, cases.NoLower).String(s)

	// Remove all spaces
	s = strings.ReplaceAll(s, " ", "")

	// Lowercase the first letter
	if len(s) > 0 {
		s = strings.ToLower(s[:1]) + s[1:]
	}

	return s
}
