package generators

import (
	"fmt"
	"github.com/grafana/cuetsy/ts/ast"
	"strings"

	"cuelang.org/go/cue"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/thema"
)

type TSConfig struct {
	CuetsyConfig *cuetsy.Config
	IsGroup      bool
	RootName     string
}

// GenerateTypesTS generates native TypeScript types and defaults corresponding to
// the provided Schema.
func GenerateTypesTS(sch thema.Schema, cfg *TSConfig) (*ast.File, error) {
	if cfg == nil {
		return nil, fmt.Errorf("configuration cannot be empty")
	}
	if cfg.CuetsyConfig == nil {
		cfg.CuetsyConfig = &cuetsy.Config{
			Export: true,
		}
	}
	if cfg.RootName == "" {
		cfg.RootName = strings.Title(sch.Lineage().Name())
	}

	file := &ts.File{}
	schdef := sch.Underlying().LookupPath(cue.ParsePath("schema"))
	tf, err := cuetsy.GenerateAST(schdef, *cfg.CuetsyConfig)
	if err != nil {
		return nil, fmt.Errorf("generating TS for child elements of schema failed: %w", err)
	}

	file.Nodes = append(file.Nodes, tf.Nodes...)

	if !cfg.IsGroup {
		top, err := cuetsy.GenerateSingleAST(cfg.RootName, schdef, cuetsy.TypeInterface)
		if err != nil {
			return nil, fmt.Errorf("generating TS for schema root failed: %w", err)
		}
		file.Nodes = append(file.Nodes, top.T)
		if top.D != nil {
			file.Nodes = append(file.Nodes, top.D)
		}
	}

	return file, nil
}
