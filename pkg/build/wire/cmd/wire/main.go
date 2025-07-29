// Copyright 2018 The Wire Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Wire is a compile-time dependency injection tool.
//
// For an overview, see https://github.com/google/wire/blob/master/README.md
package main

import (
	"context"
	"flag"
	"fmt"
	"go/token"
	"go/types"
	"io/ioutil"
	"log"
	"os"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"github.com/google/subcommands"
	"github.com/grafana/grafana/pkg/build/wire/internal/wire"
	"github.com/pmezard/go-difflib/difflib"
	"golang.org/x/tools/go/types/typeutil"
)

func main() {
	subcommands.Register(subcommands.CommandsCommand(), "")
	subcommands.Register(subcommands.FlagsCommand(), "")
	subcommands.Register(subcommands.HelpCommand(), "")
	subcommands.Register(&checkCmd{}, "")
	subcommands.Register(&diffCmd{}, "")
	subcommands.Register(&genCmd{}, "")
	subcommands.Register(&showCmd{}, "")
	flag.Parse()

	// Initialize the default logger to log to stderr.
	log.SetFlags(0)
	log.SetPrefix("wire: ")
	log.SetOutput(os.Stderr)

	// TODO(rvangent): Use subcommands's VisitCommands instead of hardcoded map,
	// once there is a release that contains it:
	// allCmds := map[string]bool{}
	// subcommands.DefaultCommander.VisitCommands(func(_ *subcommands.CommandGroup, cmd subcommands.Command) { allCmds[cmd.Name()] = true })
	allCmds := map[string]bool{
		"commands": true, // builtin
		"help":     true, // builtin
		"flags":    true, // builtin
		"check":    true,
		"diff":     true,
		"gen":      true,
		"show":     true,
	}
	// Default to running the "gen" command.
	if args := flag.Args(); len(args) == 0 || !allCmds[args[0]] {
		genCmd := &genCmd{}
		os.Exit(int(genCmd.Execute(context.Background(), flag.CommandLine)))
	}
	os.Exit(int(subcommands.Execute(context.Background())))
}

// packages returns the slice of packages to run wire over based on f.
// It defaults to ".".
func packages(f *flag.FlagSet) []string {
	pkgs := f.Args()
	if len(pkgs) == 0 {
		pkgs = []string{"."}
	}
	return pkgs
}

// newGenerateOptions returns an initialized wire.GenerateOptions, possibly
// with the Header option set.
func newGenerateOptions(headerFile string) (*wire.GenerateOptions, error) {
	opts := new(wire.GenerateOptions)
	if headerFile != "" {
		var err error
		opts.Header, err = ioutil.ReadFile(headerFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read header file %q: %v", headerFile, err)
		}
	}
	return opts, nil
}

type genCmd struct {
	headerFile     string
	prefixFileName string
	tags           string
	genTags        string
}

func (*genCmd) Name() string { return "gen" }
func (*genCmd) Synopsis() string {
	return "generate the wire_gen.go file for each package"
}
func (*genCmd) Usage() string {
	return `gen [packages]

  Given one or more packages, gen creates the wire_gen.go file for each.

  If no packages are listed, it defaults to ".".
`
}
func (cmd *genCmd) SetFlags(f *flag.FlagSet) {
	f.StringVar(&cmd.headerFile, "header_file", "", "path to file to insert as a header in wire_gen.go")
	f.StringVar(&cmd.prefixFileName, "output_file_prefix", "", "string to prepend to output file names.")
	f.StringVar(&cmd.tags, "tags", "", "append build tags to the default wirebuild")
	f.StringVar(&cmd.genTags, "gen_tags", "", "append build tags to the generated file")
}

func (cmd *genCmd) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	wd, err := os.Getwd()
	if err != nil {
		log.Println("failed to get working directory: ", err)
		return subcommands.ExitFailure
	}
	opts, err := newGenerateOptions(cmd.headerFile)
	if err != nil {
		log.Println(err)
		return subcommands.ExitFailure
	}

	opts.PrefixOutputFile = cmd.prefixFileName
	opts.Tags = cmd.tags
	opts.GenTags = cmd.genTags

	outs, errs := wire.Generate(ctx, wd, os.Environ(), packages(f), opts)
	if len(errs) > 0 {
		logErrors(errs)
		log.Println("generate failed")
		return subcommands.ExitFailure
	}
	if len(outs) == 0 {
		return subcommands.ExitSuccess
	}
	success := true
	for _, out := range outs {
		if len(out.Errs) > 0 {
			logErrors(out.Errs)
			log.Printf("%s: generate failed\n", out.PkgPath)
			success = false
		}
		if len(out.Content) == 0 {
			// No Wire output. Maybe errors, maybe no Wire directives.
			continue
		}
		if err := out.Commit(); err == nil {
			log.Printf("%s: wrote %s\n", out.PkgPath, out.OutputPath)
		} else {
			log.Printf("%s: failed to write %s: %v\n", out.PkgPath, out.OutputPath, err)
			success = false
		}
	}
	if !success {
		log.Println("at least one generate failure")
		return subcommands.ExitFailure
	}
	return subcommands.ExitSuccess
}

type diffCmd struct {
	headerFile string
	tags       string
}

func (*diffCmd) Name() string { return "diff" }
func (*diffCmd) Synopsis() string {
	return "output a diff between existing wire_gen.go files and what gen would generate"
}
func (*diffCmd) Usage() string {
	return `diff [packages]

  Given one or more packages, diff generates the content for their wire_gen.go
  files and outputs the diff against the existing files.

  If no packages are listed, it defaults to ".".

  Similar to the diff command, it returns 0 if no diff, 1 if different, 2
  plus an error if trouble.
`
}
func (cmd *diffCmd) SetFlags(f *flag.FlagSet) {
	f.StringVar(&cmd.headerFile, "header_file", "", "path to file to insert as a header in wire_gen.go")
	f.StringVar(&cmd.tags, "tags", "", "append build tags to the default wirebuild")
}
func (cmd *diffCmd) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	const (
		errReturn  = subcommands.ExitStatus(2)
		diffReturn = subcommands.ExitStatus(1)
	)
	wd, err := os.Getwd()
	if err != nil {
		log.Println("failed to get working directory: ", err)
		return errReturn
	}
	opts, err := newGenerateOptions(cmd.headerFile)
	if err != nil {
		log.Println(err)
		return subcommands.ExitFailure
	}

	opts.Tags = cmd.tags

	outs, errs := wire.Generate(ctx, wd, os.Environ(), packages(f), opts)
	if len(errs) > 0 {
		logErrors(errs)
		log.Println("generate failed")
		return errReturn
	}
	if len(outs) == 0 {
		return subcommands.ExitSuccess
	}
	success := true
	hadDiff := false
	for _, out := range outs {
		if len(out.Errs) > 0 {
			logErrors(out.Errs)
			log.Printf("%s: generate failed\n", out.PkgPath)
			success = false
		}
		if len(out.Content) == 0 {
			// No Wire output. Maybe errors, maybe no Wire directives.
			continue
		}
		// Assumes the current file is empty if we can't read it.
		cur, _ := ioutil.ReadFile(out.OutputPath)
		if diff, err := difflib.GetUnifiedDiffString(difflib.UnifiedDiff{
			A: difflib.SplitLines(string(cur)),
			B: difflib.SplitLines(string(out.Content)),
		}); err == nil {
			if diff != "" {
				// Print the actual diff to stdout, not stderr.
				fmt.Printf("%s: diff from %s:\n%s\n", out.PkgPath, out.OutputPath, diff)
				hadDiff = true
			}
		} else {
			log.Printf("%s: failed to diff %s: %v\n", out.PkgPath, out.OutputPath, err)
			success = false
		}
	}
	if !success {
		log.Println("at least one generate failure")
		return errReturn
	}
	if hadDiff {
		return diffReturn
	}
	return subcommands.ExitSuccess
}

type showCmd struct {
	tags string
}

func (*showCmd) Name() string { return "show" }
func (*showCmd) Synopsis() string {
	return "describe all top-level provider sets"
}
func (*showCmd) Usage() string {
	return `show [packages]

  Given one or more packages, show finds all the provider sets declared as
  top-level variables and prints what other provider sets they import and what
  outputs they can produce, given possible inputs. It also lists any injector
  functions defined in the package.

  If no packages are listed, it defaults to ".".
`
}
func (cmd *showCmd) SetFlags(f *flag.FlagSet) {
	f.StringVar(&cmd.tags, "tags", "", "append build tags to the default wirebuild")
}
func (cmd *showCmd) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	wd, err := os.Getwd()
	if err != nil {
		log.Println("failed to get working directory: ", err)
		return subcommands.ExitFailure
	}
	info, errs := wire.Load(ctx, wd, os.Environ(), cmd.tags, packages(f))
	if info != nil {
		keys := make([]wire.ProviderSetID, 0, len(info.Sets))
		for k := range info.Sets {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool {
			if keys[i].ImportPath == keys[j].ImportPath {
				return keys[i].VarName < keys[j].VarName
			}
			return keys[i].ImportPath < keys[j].ImportPath
		})
		for i, k := range keys {
			if i > 0 {
				fmt.Println()
			}
			outGroups, imports := gather(info, k)
			fmt.Println(k)
			for _, imp := range sortSet(imports) {
				fmt.Printf("\t%s\n", imp)
			}
			for i := range outGroups {
				fmt.Printf("\tOutputs given %s:\n", outGroups[i].name)
				out := make(map[string]token.Pos, outGroups[i].outputs.Len())
				outGroups[i].outputs.Iterate(func(t types.Type, v interface{}) {
					switch v := v.(type) {
					case *wire.Provider:
						out[types.TypeString(t, nil)] = v.Pos
					case *wire.Value:
						out[types.TypeString(t, nil)] = v.Pos
					case *wire.Field:
						out[types.TypeString(t, nil)] = v.Pos
					default:
						panic("unreachable")
					}
				})
				for _, t := range sortSet(out) {
					fmt.Printf("\t\t%s\n", t)
					fmt.Printf("\t\t\tat %v\n", info.Fset.Position(out[t]))
				}
			}
		}
		if len(info.Injectors) > 0 {
			injectors := append([]*wire.Injector(nil), info.Injectors...)
			sort.Slice(injectors, func(i, j int) bool {
				if injectors[i].ImportPath == injectors[j].ImportPath {
					return injectors[i].FuncName < injectors[j].FuncName
				}
				return injectors[i].ImportPath < injectors[j].ImportPath
			})
			fmt.Println("\nInjectors:")
			for _, in := range injectors {
				fmt.Printf("\t%v\n", in)
			}
		}
	}
	if len(errs) > 0 {
		logErrors(errs)
		log.Println("error loading packages")
		return subcommands.ExitFailure
	}
	return subcommands.ExitSuccess
}

type checkCmd struct {
	tags string
}

func (*checkCmd) Name() string { return "check" }
func (*checkCmd) Synopsis() string {
	return "print any Wire errors found"
}
func (*checkCmd) Usage() string {
	return `check [-tags tag,list] [packages]

  Given one or more packages, check prints any type-checking or Wire errors
  found with top-level variable provider sets or injector functions.

  If no packages are listed, it defaults to ".".
`
}
func (cmd *checkCmd) SetFlags(f *flag.FlagSet) {
	f.StringVar(&cmd.tags, "tags", "", "append build tags to the default wirebuild")
}
func (cmd *checkCmd) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	wd, err := os.Getwd()
	if err != nil {
		log.Println("failed to get working directory: ", err)
		return subcommands.ExitFailure
	}
	_, errs := wire.Load(ctx, wd, os.Environ(), cmd.tags, packages(f))
	if len(errs) > 0 {
		logErrors(errs)
		log.Println("error loading packages")
		return subcommands.ExitFailure
	}
	return subcommands.ExitSuccess
}

type outGroup struct {
	name    string
	inputs  *typeutil.Map // values are not important
	outputs *typeutil.Map // values are *wire.Provider, *wire.Value, or *wire.Field
}

// gather flattens a provider set into outputs grouped by the inputs
// required to create them. As it flattens the provider set, it records
// the visited named provider sets as imports.
func gather(info *wire.Info, key wire.ProviderSetID) (_ []outGroup, imports map[string]struct{}) {
	set := info.Sets[key]
	hash := typeutil.MakeHasher()

	// Find imports.
	next := []*wire.ProviderSet{info.Sets[key]}
	visited := make(map[*wire.ProviderSet]struct{})
	imports = make(map[string]struct{})
	for len(next) > 0 {
		curr := next[len(next)-1]
		next = next[:len(next)-1]
		if _, found := visited[curr]; found {
			continue
		}
		visited[curr] = struct{}{}
		if curr.VarName != "" && !(curr.PkgPath == key.ImportPath && curr.VarName == key.VarName) {
			imports[formatProviderSetName(curr.PkgPath, curr.VarName)] = struct{}{}
		}
		next = append(next, curr.Imports...)
	}

	// Depth-first search to build groups.
	var groups []outGroup
	inputVisited := new(typeutil.Map) // values are int, indices into groups or -1 for input.
	inputVisited.SetHasher(hash)
	var stk []types.Type
	for _, k := range set.Outputs() {
		// Start a DFS by picking a random unvisited node.
		if inputVisited.At(k) == nil {
			stk = append(stk, k)
		}

		// Run DFS
	dfs:
		for len(stk) > 0 {
			curr := stk[len(stk)-1]
			stk = stk[:len(stk)-1]
			if inputVisited.At(curr) != nil {
				continue
			}
			switch pv := set.For(curr); {
			case pv.IsNil():
				// This is an input.
				inputVisited.Set(curr, -1)
			case pv.IsArg():
				// This is an injector argument.
				inputVisited.Set(curr, -1)
			case pv.IsProvider():
				// Try to see if any args haven't been visited.
				p := pv.Provider()
				allPresent := true
				for _, arg := range p.Args {
					if inputVisited.At(arg.Type) == nil {
						allPresent = false
					}
				}
				if !allPresent {
					stk = append(stk, curr)
					for _, arg := range p.Args {
						if inputVisited.At(arg.Type) == nil {
							stk = append(stk, arg.Type)
						}
					}
					continue dfs
				}

				// Build up set of input types, match to a group.
				in := new(typeutil.Map)
				in.SetHasher(hash)
				for _, arg := range p.Args {
					i := inputVisited.At(arg.Type).(int)
					if i == -1 {
						in.Set(arg.Type, true)
					} else {
						mergeTypeSets(in, groups[i].inputs)
					}
				}
				for i := range groups {
					if sameTypeKeys(groups[i].inputs, in) {
						groups[i].outputs.Set(curr, p)
						inputVisited.Set(curr, i)
						continue dfs
					}
				}
				out := new(typeutil.Map)
				out.SetHasher(hash)
				out.Set(curr, p)
				inputVisited.Set(curr, len(groups))
				groups = append(groups, outGroup{
					inputs:  in,
					outputs: out,
				})
			case pv.IsValue():
				v := pv.Value()
				for i := range groups {
					if groups[i].inputs.Len() == 0 {
						groups[i].outputs.Set(curr, v)
						inputVisited.Set(curr, i)
						continue dfs
					}
				}
				in := new(typeutil.Map)
				in.SetHasher(hash)
				out := new(typeutil.Map)
				out.SetHasher(hash)
				out.Set(curr, v)
				inputVisited.Set(curr, len(groups))
				groups = append(groups, outGroup{
					inputs:  in,
					outputs: out,
				})
			case pv.IsField():
				// Try to see if the parent struct hasn't been visited.
				f := pv.Field()
				if inputVisited.At(f.Parent) == nil {
					stk = append(stk, curr, f.Parent)
					continue
				}
				// Build the input map for the parent struct.
				in := new(typeutil.Map)
				in.SetHasher(hash)
				i := inputVisited.At(f.Parent).(int)
				if i == -1 {
					in.Set(f.Parent, true)
				} else {
					mergeTypeSets(in, groups[i].inputs)
				}
				// Group all fields together under the same parent struct.
				for i := range groups {
					if sameTypeKeys(groups[i].inputs, in) {
						groups[i].outputs.Set(curr, f)
						inputVisited.Set(curr, i)
						continue dfs
					}
				}
				out := new(typeutil.Map)
				out.SetHasher(hash)
				out.Set(curr, f)
				inputVisited.Set(curr, len(groups))
				groups = append(groups, outGroup{
					inputs:  in,
					outputs: out,
				})
			default:
				panic("unreachable")
			}
		}
	}

	// Name and sort groups.
	for i := range groups {
		if groups[i].inputs.Len() == 0 {
			groups[i].name = "no inputs"
			continue
		}
		instr := make([]string, 0, groups[i].inputs.Len())
		groups[i].inputs.Iterate(func(k types.Type, _ interface{}) {
			instr = append(instr, types.TypeString(k, nil))
		})
		sort.Strings(instr)
		groups[i].name = strings.Join(instr, ", ")
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].inputs.Len() == groups[j].inputs.Len() {
			return groups[i].name < groups[j].name
		}
		return groups[i].inputs.Len() < groups[j].inputs.Len()
	})
	return groups, imports
}

func mergeTypeSets(dst, src *typeutil.Map) {
	src.Iterate(func(k types.Type, _ interface{}) {
		dst.Set(k, true)
	})
}

func sameTypeKeys(a, b *typeutil.Map) bool {
	if a.Len() != b.Len() {
		return false
	}
	same := true
	a.Iterate(func(k types.Type, _ interface{}) {
		if b.At(k) == nil {
			same = false
		}
	})
	return same
}

func sortSet(set interface{}) []string {
	rv := reflect.ValueOf(set)
	a := make([]string, 0, rv.Len())
	keys := rv.MapKeys()
	for _, k := range keys {
		a = append(a, k.String())
	}
	sort.Strings(a)
	return a
}

func formatProviderSetName(importPath, varName string) string {
	// Since varName is an identifier, it doesn't make sense to quote.
	return strconv.Quote(importPath) + "." + varName
}

func logErrors(errs []error) {
	for _, err := range errs {
		log.Println(strings.Replace(err.Error(), "\n", "\n\t", -1))
	}
}
