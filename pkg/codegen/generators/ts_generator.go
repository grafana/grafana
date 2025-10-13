package generators

import (
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/cuetsy/ts/ast"
)

type TSConfig struct {
	CuetsyConfig *cuetsy.Config
	IsGroup      bool
	RootName     string
}

// GenerateTypesTS generates native TypeScript types and defaults corresponding to
// the provided Schema.
func GenerateTypesTS(v cue.Value, cfg *TSConfig) (*ast.File, error) {
	if cfg == nil {
		return nil, fmt.Errorf("configuration cannot be empty")
	}
	if cfg.CuetsyConfig == nil {
		cfg.CuetsyConfig = &cuetsy.Config{
			Export: true,
		}
	}

	// Thema #schema was a unification between the schema and cue.TopKind(_). For any reason, without this unification,
	// cuetsy fails finding some enums ¯\_(ツ)_/¯.
	oldSchema := cuecontext.New().CompileBytes([]byte("_"))
	schdef := v.LookupPath(cue.ParsePath("lineage.schemas[0].schema")).Unify(oldSchema)
	tf, err := cuetsy.GenerateAST(schdef, *cfg.CuetsyConfig)
	if err != nil {
		return nil, fmt.Errorf("generating TS for child elements of schema failed: %w", err)
	}

	file := &ts.File{
		Nodes: tf.Nodes,
	}

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
