package codegen

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/gocode"
	"github.com/grafana/thema/encoding/openapi"
)

type ResourceGoTypesJenny struct {
	ApplyFuncs       []dstutil.ApplyFunc
	ExpandReferences bool
}

func (*ResourceGoTypesJenny) JennyName() string {
	return "GoTypesJenny"
}

func (ag *ResourceGoTypesJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	sch := sfg.Schema

	b, err := gocode.GenerateTypesOpenAPI(sch, &gocode.TypeConfigOpenAPI{
		// TODO will need to account for sanitizing e.g. dashes here at some point
		Config: &openapi.Config{
			Group:    false, // TODO: better
			RootName: typeNameFromKey(sch.Lineage().Name()),
		},
		PackageName: sfg.Schema.Lineage().Name(),
		ApplyFuncs:  append(ag.ApplyFuncs, PrefixDropper(sfg.Name)),
	})
	if err != nil {
		return nil, err
	}
	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_gen.go", b, ag), nil
}

type SubresourceGoTypesJenny struct {
	ApplyFuncs       []dstutil.ApplyFunc
	ExpandReferences bool
}

func (*SubresourceGoTypesJenny) JennyName() string {
	return "GoResourceTypes"
}

func (g *SubresourceGoTypesJenny) Generate(kind kindsys.Kind) (codejen.Files, error) {
	comm := kind.Props().Common()
	sfg := SchemaForGen{
		Name:    comm.Name,
		Schema:  kind.Lineage().Latest(),
		IsGroup: comm.LineageIsGroup,
	}
	sch := sfg.Schema

	// Iterate through all top-level fields and make go types for them
	// (this should consist of "spec" and arbitrary subresources)
	i, err := sch.Underlying().Fields()
	if err != nil {
		return nil, err
	}
	files := make(codejen.Files, 0)
	for i.Next() {
		str := i.Selector().String()

		b, err := gocode.GenerateTypesOpenAPI(sch, &gocode.TypeConfigOpenAPI{
			// TODO will need to account for sanitizing e.g. dashes here at some point
			Config: &openapi.Config{
				Group:    false, // TODO: better
				RootName: typeNameFromKey(str),
				Subpath:  cue.MakePath(cue.Str(str)),
			},
			PackageName: sfg.Schema.Lineage().Name(),
			ApplyFuncs:  append(g.ApplyFuncs, PrefixDropper(sfg.Name)),
		})
		if err != nil {
			return nil, err
		}

		name := sfg.Schema.Lineage().Name()
		files = append(files, codejen.File{
			RelativePath: fmt.Sprintf("pkg/kinds/%s/%s_%s_gen.go", name, name, strings.ToLower(str)),
			Data:         b,
			From:         []codejen.NamedJenny{g},
		})
	}

	return files, nil
}

func typeNameFromKey(key string) string {
	if len(key) > 0 {
		return strings.ToUpper(key[:1]) + key[1:]
	}
	return strings.ToUpper(key)
}

type subresourceInfo struct {
	TypeName  string
	FieldName string
}

func getSubresources(sch thema.Schema) []subresourceInfo {
	subs := make([]subresourceInfo, 0)
	i, err := sch.Underlying().Fields()
	if err != nil {
		return nil
	}
	for i.Next() {
		str, _ := i.Value().Label()
		if str == "spec" {
			continue
		}
		subs = append(subs, subresourceInfo{
			FieldName: str,
			TypeName:  typeNameFromKey(str),
		})
	}
	return subs
}
