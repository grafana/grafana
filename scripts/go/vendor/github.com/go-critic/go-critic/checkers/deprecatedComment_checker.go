package checkers

import (
	"go/ast"
	"regexp"
	"strings"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "deprecatedComment"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects malformed 'deprecated' doc-comments"
	info.Before = `
// deprecated, use FuncNew instead
func FuncOld() int`
	info.After = `
// Deprecated: use FuncNew instead
func FuncOld() int`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		c := &deprecatedCommentChecker{ctx: ctx}

		c.commonPatterns = []*regexp.Regexp{
			regexp.MustCompile(`(?i)this (?:function|type) is deprecated`),
			regexp.MustCompile(`(?i)deprecated[.!]? use \S* instead`),
			regexp.MustCompile(`(?i)\[\[deprecated\]\].*`),
			regexp.MustCompile(`(?i)note: deprecated\b.*`),
			regexp.MustCompile(`(?i)deprecated in.*`),
			// TODO(quasilyte): more of these?
		}

		// TODO(quasilyte): may want to generate this list programmatically.
		//
		// TODO(quasilyte): currently it only handles a single missing letter.
		// Might want to handle other kinds of common misspell/typo kinds.
		c.commonTypos = []string{
			"Dprecated: ",
			"Derecated: ",
			"Depecated: ",
			"Deprcated: ",
			"Depreated: ",
			"Deprected: ",
			"Deprecaed: ",
			"Deprecatd: ",
			"Deprecate: ",
			"Derpecate: ",
			"Derpecated: ",
			"Depreacted: ",
		}
		for i := range c.commonTypos {
			c.commonTypos[i] = strings.ToUpper(c.commonTypos[i])
		}

		return astwalk.WalkerForDocComment(c)
	})
}

type deprecatedCommentChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	commonPatterns []*regexp.Regexp
	commonTypos    []string
}

func (c *deprecatedCommentChecker) VisitDocComment(doc *ast.CommentGroup) {
	// There are 3 accepted forms of deprecation comments:
	//
	// 1. inline, that can't be handled with a DocCommentVisitor.
	//    Note that "Deprecated: " may not even be the comment prefix there.
	//    Example: "The line number in the input. Deprecated: Kept for compatibility."
	//    TODO(quasilyte): fix it.
	//
	// 2. Longer form-1. It's a doc-comment that only contains "deprecation" notice.
	//
	// 3. Like form-2, but may also include doc-comment text.
	//    Distinguished by an empty line.
	//
	// See https://github.com/golang/go/issues/10909#issuecomment-136492606.
	//
	// It's desirable to see how people make mistakes with the format,
	// this is why there is currently no special treatment for these cases.
	// TODO(quasilyte): do more audits and grow the negative tests suite.
	//
	// TODO(quasilyte): there are also multi-line deprecation comments.

	for _, comment := range doc.List {
		if strings.HasPrefix(comment.Text, "/*") {
			// TODO(quasilyte): handle multi-line doc comments.
			continue
		}
		l := comment.Text[len("//"):]
		if len(l) < len("Deprecated: ") {
			continue
		}
		l = strings.TrimSpace(l)

		// Check whether someone messed up with a prefix casing.
		upcase := strings.ToUpper(l)
		if strings.HasPrefix(upcase, "DEPRECATED: ") && !strings.HasPrefix(l, "Deprecated: ") {
			c.warnCasing(comment, l)
			return
		}

		// Check is someone used comma instead of a colon.
		if strings.HasPrefix(l, "Deprecated, ") {
			c.warnComma(comment)
			return
		}

		// Check for other commonly used patterns.
		for _, pat := range c.commonPatterns {
			if pat.MatchString(l) {
				c.warnPattern(comment)
				return
			}
		}

		// Detect some simple typos.
		for _, prefixWithTypo := range c.commonTypos {
			if strings.HasPrefix(upcase, prefixWithTypo) {
				c.warnTypo(comment, l)
				return
			}
		}
	}
}

func (c *deprecatedCommentChecker) warnCasing(cause ast.Node, line string) {
	prefix := line[:len("DEPRECATED: ")]
	c.ctx.Warn(cause, "use `Deprecated: ` (note the casing) instead of `%s`", prefix)
}

func (c *deprecatedCommentChecker) warnPattern(cause ast.Node) {
	c.ctx.Warn(cause, "the proper format is `Deprecated: <text>`")
}

func (c *deprecatedCommentChecker) warnComma(cause ast.Node) {
	c.ctx.Warn(cause, "use `:` instead of `,` in `Deprecated, `")
}

func (c *deprecatedCommentChecker) warnTypo(cause ast.Node, line string) {
	word := strings.Split(line, ":")[0]
	c.ctx.Warn(cause, "typo in `%s`; should be `Deprecated`", word)
}
