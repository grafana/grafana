package main

import (
	"os"
	"strings"
)

type fileSearchParams struct {
	// testNamesContain will match any test function whose name contains this string.
	// Test functions must be prefixed with "Test" to be included.
	testNamesContain []string
	// testNamesStartWith will match any test function whose name starts with this string.
	// Test functions must be prefixed with "Test" to be included.
	// All values in this slice must include the prefix "Test", otherwise it will not match.
	testNamesStartWith []string
}

func (p *fileSearchParams) CountFileMatches(path string) (int, error) {
	if !strings.HasSuffix(path, "_test.go") {
		return 0, nil
	}

	body, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}

	return p.CountBodyMatches(string(body)), nil
}

func (p *fileSearchParams) CountBodyMatches(body string) int {
	funcs := p.findFunctionDecls(body)
	if len(p.testNamesContain) < 1 && len(p.testNamesStartWith) < 1 {
		return len(funcs)
	}

	funcNames := p.findFunctionNames(funcs)
	if len(funcNames) == 0 {
		return 0
	}

	matches := make(map[string]struct{})
	for _, name := range p.testNamesContain {
		for _, funcName := range funcNames {
			if _, ok := matches[funcName]; ok {
				continue
			}
			if strings.Contains(funcName, name) {
				matches[funcName] = struct{}{}
				break
			}
		}
	}

	for _, name := range p.testNamesStartWith {
		for _, funcName := range funcNames {
			if _, ok := matches[funcName]; ok {
				continue
			}
			if strings.HasPrefix(funcName, name) {
				matches[funcName] = struct{}{}
				break
			}
		}
	}

	return len(matches)
}

// findFunctionDecls will find all function declarations in the body.
// It will return a slice of strings, each string is a function declaration.
// The function declarations must be prefixed with "func Test" to be included.
func (p *fileSearchParams) findFunctionDecls(body string) []string {
	var funcDecls []string
	for line := range strings.Lines(body) {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "func Test") {
			funcDecls = append(funcDecls, line)
		}
	}
	return funcDecls
}

func (p *fileSearchParams) findFunctionNames(funcDecls []string) []string {
	names := make([]string, 0, len(funcDecls))
	for _, decl := range funcDecls {
		words := strings.Fields(decl)
		if len(words) >= 2 {
			names = append(names, words[1])
		}
	}
	return names
}
