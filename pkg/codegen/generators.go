package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"
	"regexp"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
)

type OneToOne codejen.OneToOne[SchemaForGen]
type OneToMany codejen.OneToMany[SchemaForGen]
type ManyToOne codejen.ManyToOne[SchemaForGen]
type ManyToMany codejen.ManyToMany[SchemaForGen]

func leader(path string) string {
	// Never inject on certain filetypes, it's never valid
	switch filepath.Ext(path) {
	case ".json", ".md":
		return path
	case ".yml", ".yaml":
		return "#"
	default:
		return "//"
	}
}

// SlashHeaderMapper produces a FileMapper that injects a comment header onto
// a [codejen.File] indicating the main generator that produced it (via the provided
// mainGen, which should be a path) and the jenny or jennies that constructed the
// file.
func SlashHeaderMapper(mainGen string) codejen.FileMapper {
	return func(f codejen.File) (codejen.File, error) {
		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("gen_header.tmpl").Execute(buf, tvars_gen_header{
			MainGenerator: filepath.ToSlash(mainGen),
			Using:         f.From,
			Leader:        leader(f.RelativePath),
		}); err != nil {
			return codejen.File{}, fmt.Errorf("failed executing gen header template: %w", err)
		}
		fmt.Fprint(buf, string(f.Data))
		f.Data = buf.Bytes()
		return f, nil
	}
}

func PluginsSlashHeaderMapper(mainGen string, path string) codejen.FileMapper {
	return func(f codejen.File) (codejen.File, error) {
		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("gen_header.tmpl").Execute(buf, tvars_gen_header{
			MainGenerator: filepath.ToSlash(mainGen),
			Using:         f.From,
			Leader:        leader(f.RelativePath),
			CuePath:       cuePluginPath(path, f.RelativePath),
		}); err != nil {
			return codejen.File{}, fmt.Errorf("failed executing gen header template: %w", err)
		}
		fmt.Fprint(buf, string(f.Data))
		f.Data = buf.Bytes()
		return f, nil
	}
}

func cuePluginPath(root string, path string) string {
	// We need it for ts files only
	if filepath.Ext(path) != ".ts" {
		return ""
	}

	mapper := map[string]string{
		"panelcfg":  "panel",
		"dataquery": "datasource",
	}

	regx := ".+/(.*?)/(?:(panelcfg|dataquery))"
	regexexp := regexp.MustCompile(regx)
	matches := regexexp.FindStringSubmatch(path)
	if len(matches) > 2 {
		return filepath.Join(root, mapper[matches[2]], matches[1], matches[2]+".cue")
	}

	return ""
}

type SchemaForGen struct {
	Name       string
	CueFile    cue.Value
	FilePath   string
	IsGroup    bool
	OutputName string // Some TS output files are capitalised and others not.
}
