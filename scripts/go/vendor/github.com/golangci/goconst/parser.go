// Package goconst finds repeated strings that could be replaced by a constant.
//
// There are obvious benefits to using constants instead of repeating strings,
// mostly to ease maintenance. Cannot argue against changing a single constant versus many strings.
// While this could be considered a beginner mistake, across time,
// multiple packages and large codebases, some repetition could have slipped in.
package goconst

import (
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	testSuffix = "_test.go"
)

type Parser struct {
	// Meant to be passed via New()
	path, ignore               string
	ignoreTests, matchConstant bool
	minLength                  int

	supportedTokens []token.Token

	// Internals
	strs   Strings
	consts Constants
}

// New creates a new instance of the parser.
// This is your entry point if you'd like to use goconst as an API.
func New(path, ignore string, ignoreTests, matchConstant, numbers bool, minLength int) *Parser {
	supportedTokens := []token.Token{token.STRING}
	if numbers {
		supportedTokens = append(supportedTokens, token.INT, token.FLOAT)
	}

	return &Parser{
		path:            path,
		ignore:          ignore,
		ignoreTests:     ignoreTests,
		matchConstant:   matchConstant,
		minLength:       minLength,
		supportedTokens: supportedTokens,

		// Initialize the maps
		strs:   Strings{},
		consts: Constants{},
	}
}

// ParseTree will search the given path for occurrences that could be moved into constants.
// If "..." is appended, the search will be recursive.
func (p *Parser) ParseTree() (Strings, Constants, error) {
	pathLen := len(p.path)
	// Parse recursively the given path if the recursive notation is found
	if pathLen >= 5 && p.path[pathLen-3:] == "..." {
		filepath.Walk(p.path[:pathLen-3], func(path string, f os.FileInfo, err error) error {
			if err != nil {
				log.Println(err)
				// resume walking
				return nil
			}

			if f.IsDir() {
				p.parseDir(path)
			}
			return nil
		})
	} else {
		p.parseDir(p.path)
	}
	return p.strs, p.consts, nil
}

func (p *Parser) parseDir(dir string) error {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, func(info os.FileInfo) bool {
		valid, name := true, info.Name()

		if p.ignoreTests {
			if strings.HasSuffix(name, testSuffix) {
				valid = false
			}
		}

		if len(p.ignore) != 0 {
			match, err := regexp.MatchString(p.ignore, dir+name)
			if err != nil {
				log.Fatal(err)
				return true
			}
			if match {
				valid = false
			}
		}

		return valid
	}, 0)
	if err != nil {
		return err
	}

	for _, pkg := range pkgs {
		for fn, f := range pkg.Files {
			ast.Walk(&treeVisitor{
				fileSet:     fset,
				packageName: pkg.Name,
				fileName:    fn,
				p:           p,
			}, f)
		}
	}

	return nil
}

type Strings map[string][]ExtendedPos
type Constants map[string]ConstType

type ConstType struct {
	token.Position
	Name, packageName string
}

type ExtendedPos struct {
	token.Position
	packageName string
}

type Issue struct {
	Pos             token.Position
	OccurencesCount int
	Str             string
	MatchingConst   string
}

type Config struct {
	MatchWithConstants bool
	MinStringLength    int
	MinOccurrences     int
}

func Run(files []*ast.File, fset *token.FileSet, cfg *Config) ([]Issue, error) {
	p := New("", "", false, cfg.MatchWithConstants, false, cfg.MinStringLength)
	var issues []Issue
	for _, f := range files {
		ast.Walk(&treeVisitor{
			fileSet:     fset,
			packageName: "",
			fileName:    "",
			p:           p,
		}, f)
	}

	for str, item := range p.strs {
		// Filter out items whose occurrences don't match the min value
		if len(item) < cfg.MinOccurrences {
			delete(p.strs, str)
		}
	}

	for str, item := range p.strs {
		fi := item[0]
		i := Issue{
			Pos:             fi.Position,
			OccurencesCount: len(item),
			Str:             str,
		}

		if len(p.consts) != 0 {
			if cst, ok := p.consts[str]; ok {
				// const should be in the same package and exported
				i.MatchingConst = cst.Name
			}
		}
		issues = append(issues, i)
	}

	return issues, nil
}
