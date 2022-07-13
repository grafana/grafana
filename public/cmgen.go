package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/format"
	cuejson "cuelang.org/go/encoding/json"
	"cuelang.org/go/encoding/openapi"
	"github.com/getkin/kin-openapi/openapi2"
	"github.com/getkin/kin-openapi/openapi2conv"
	ecue "github.com/grafana/thema/encoding/cue"
)

// The set of types that we definitely never want to make into coremodels.
var snever = []string{
	"info",
	"Ack",
}

var never = map[string]bool{}

// The set of types that maaaaybe we want to make into coremodels via this
// method, but haven't gotten around to it yet.
var stodo = []string{
	"DataSource",
}

var todo = map[string]bool{}

func init() {
	for _, s := range snever {
		never[s] = true
	}
	for _, s := range stodo {
		todo[s] = true
	}
}

// MAKES SILLY ASSUMPTIONS ABOUT CWD - ONLY `go run` RUN THIS FROM THE DIR IT'S IN
func main() {
	byt, err := ioutil.ReadFile("api-merged.json")
	if err != nil {
		panic(err)
	}

	var doc2 openapi2.T
	if err = json.Unmarshal(byt, &doc2); err != nil {
		panic(err)
	}

	doc3, err := openapi2conv.ToV3(&doc2)
	if err != nil {
		panic(err)
	}

	j3, err := doc3.MarshalJSON()
	if err != nil {
		panic(err)
	}

	ctx := cuecontext.New()
	expr, err := cuejson.Extract("input", j3)
	if err != nil {
		panic(err)
	}
	f := &ast.File{
		Decls: []ast.Decl{expr},
	}

	rt := (*cue.Runtime)(ctx)
	inst, err := rt.CompileFile(f)
	if err != nil {
		panic(err)
	}

	fo, err := openapi.Extract(inst, &openapi.Config{})
	if err != nil {
		panic(err)
	}

	// ////
	// b, err := format.Node(fo)
	// if err != nil {
	// 	panic(err)
	// }
	// fmt.Println(string(b))
	// ////

	fv := ctx.BuildFile(fo)
	iter, err := fv.Fields(cue.Definitions(true))
	if err != nil {
		panic(err)
	}
	for iter.Next() {
		n := strings.TrimPrefix(iter.Selector().String(), "#")
		if never[n] || todo[n] || iter.Value().Kind() != cue.StructKind {
			fmt.Printf("skipping %s...\n", n)
			continue
		}
		nlow := strings.ToLower(n)
		// Eval to deref any cross-refs
		// TODO definitely not OK
		linf, err := ecue.NewLineage(iter.Value().Eval(), nlow, nlow)
		if err != nil {
			panic(fmt.Sprintf("%s: %s", n, err))
		}

		byt, err := format.Node(linf, format.TabIndent(true), format.Simplify())
		if err != nil {
			panic(fmt.Sprintf("%s: %s", n, err))
		}

		err = os.MkdirAll(filepath.Join("..", "pkg", "coremodel", nlow), 0750)
		if err != nil {
			panic(fmt.Sprintf("%s: %s", n, err))
		}
		os.WriteFile(filepath.Join("..", "pkg", "coremodel", nlow, "coremodel.cue"), byt, 0664)
		if err != nil {
			panic(fmt.Sprintf("%s: %s", n, err))
		}
	}
}
