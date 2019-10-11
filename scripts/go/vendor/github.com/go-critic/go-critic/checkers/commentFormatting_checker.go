package checkers

import (
	"go/ast"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "commentFormatting"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects comments with non-idiomatic formatting"
	info.Before = `//This is a comment`
	info.After = `// This is a comment`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		parts := []string{
			`^//\w+:.*$`,      //key: value
			`^//nolint$`,      //nolint
			`^//line /.*:\d+`, //line /path/to/file:123
		}
		pat := "(?m)" + strings.Join(parts, "|")
		pragmaRE := regexp.MustCompile(pat)
		return astwalk.WalkerForComment(&commentFormattingChecker{
			ctx:      ctx,
			pragmaRE: pragmaRE,
		})
	})
}

type commentFormattingChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	pragmaRE *regexp.Regexp
}

func (c *commentFormattingChecker) VisitComment(cg *ast.CommentGroup) {
	if strings.HasPrefix(cg.List[0].Text, "/*") {
		return
	}
	for _, comment := range cg.List {
		if len(comment.Text) <= len("// ") {
			continue
		}
		if c.pragmaRE.MatchString(comment.Text) {
			continue
		}

		// Make a decision based on a first comment text rune.
		r, _ := utf8.DecodeRuneInString(comment.Text[len("//"):])
		if !c.specialChar(r) && !unicode.IsSpace(r) {
			c.warn(cg)
			return
		}
	}
}

func (c *commentFormattingChecker) specialChar(r rune) bool {
	// Permitted list to avoid false-positives.
	switch r {
	case '+', '-', '#', '!':
		return true
	default:
		return false
	}
}

func (c *commentFormattingChecker) warn(cg *ast.CommentGroup) {
	c.ctx.Warn(cg, "put a space between `//` and comment text")
}
