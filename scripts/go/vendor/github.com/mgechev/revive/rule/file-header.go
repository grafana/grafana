package rule

import (
	"go/ast"
	"regexp"

	"github.com/mgechev/revive/lint"
)

// FileHeaderRule lints given else constructs.
type FileHeaderRule struct{}

// Apply applies the rule to given file.
func (r *FileHeaderRule) Apply(file *lint.File, arguments lint.Arguments) []lint.Failure {
	var failures []lint.Failure

	header, ok := arguments[0].(string)
	if !ok {
		panic("Invalid argument to the FileHeaderRule")
	}

	regex, err := regexp.Compile(header)
	if err != nil {
		panic(err.Error())
	}

	fileAst := file.AST
	walker := lintFileHeader{
		file:    file,
		fileAst: fileAst,
		regex:   regex,
		onFailure: func(failure lint.Failure) {
			failures = append(failures, failure)
		},
	}

	ast.Walk(walker, fileAst)

	return failures
}

// Name returns the rule name.
func (r *FileHeaderRule) Name() string {
	return "file-header"
}

type lintFileHeader struct {
	file      *lint.File
	fileAst   *ast.File
	regex     *regexp.Regexp
	onFailure func(lint.Failure)
}

func (w lintFileHeader) Visit(_ ast.Node) ast.Visitor {
	g := w.fileAst.Comments[0]
	failure := lint.Failure{
		Node:       w.fileAst,
		Confidence: 1,
		Failure:    "the file doesn't have an appropriate header",
	}
	if g == nil {
		w.onFailure(failure)
		return nil
	}
	multi := regexp.MustCompile("^/\\*")
	single := regexp.MustCompile("^//")
	comment := ""
	for _, c := range g.List {
		text := c.Text
		if multi.Match([]byte(text)) {
			text = text[2 : len(text)-2]
		} else if single.Match([]byte(text)) {
			text = text[2:]
		}
		comment += text
	}

	if !w.regex.Match([]byte(comment)) {
		w.onFailure(failure)
	}
	return nil
}
