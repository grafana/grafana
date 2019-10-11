package checkers

import (
	"go/ast"
	"go/token"
	"go/types"
	"strings"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "wrapperFunc"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects function calls that can be replaced with convenience wrappers"
	info.Before = `wg.Add(-1)`
	info.After = `wg.Done()`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		type arg struct {
			index int
			value string
		}
		type pattern struct {
			pkg        string
			typ        string // Only for typ patterns
			args       []arg
			suggestion string
		}
		type matcher struct {
			pkgPatterns []pattern
			typPatterns []pattern
		}

		typPatterns := map[string][]arg{
			"sync.WaitGroup.Add => WaitGroup.Done": {
				{0, "-1"},
			},

			"bytes.Buffer.Truncate => Buffer.Reset": {
				{0, "0"},
			},
		}

		pkgPatterns := map[string][]arg{
			"http.HandlerFunc => http.NotFoundHandler": {
				{0, "http.NotFound"},
			},

			"strings.SplitN => strings.Split": {
				{2, "-1"},
			},
			"strings.Replace => strings.ReplaceAll": {
				{3, "-1"},
			},
			"strings.TrimFunc => strings.TrimSpace": {
				{1, "unicode.IsSpace"},
			},
			"strings.Map => strings.ToTitle": {
				{0, "unicode.ToTitle"},
			},

			"bytes.SplitN => bytes.Split": {
				{2, "-1"},
			},
			"bytes.Replace => bytes.ReplaceAll": {
				{3, "-1"},
			},
			"bytes.TrimFunc => bytes.TrimSpace": {
				{1, "unicode.IsSpace"},
			},
			"bytes.Map => bytes.ToUpper": {
				{0, "unicode.ToUpper"},
			},
			"bytes.Map => bytes.ToLower": {
				{0, "unicode.ToLower"},
			},
			"bytes.Map => bytes.ToTitle": {
				{0, "unicode.ToTitle"},
			},
		}

		matchers := make(map[string]*matcher)

		type templateKey struct {
			from string
			to   string
		}
		decodeKey := func(key string) templateKey {
			parts := strings.Split(key, " => ")
			return templateKey{from: parts[0], to: parts[1]}
		}

		// Expand pkg patterns.
		for key, args := range pkgPatterns {
			key := decodeKey(key)
			parts := strings.Split(key.from, ".")
			fn := parts[1]
			m := matchers[fn]
			if m == nil {
				m = &matcher{}
				matchers[fn] = m
			}
			m.pkgPatterns = append(m.pkgPatterns, pattern{
				pkg:        parts[0],
				args:       args,
				suggestion: key.to,
			})
		}
		// Expand typ patterns.
		for key, args := range typPatterns {
			key := decodeKey(key)
			parts := strings.Split(key.from, ".")
			fn := parts[2]
			m := matchers[fn]
			if m == nil {
				m = &matcher{}
				matchers[fn] = m
			}
			m.typPatterns = append(m.typPatterns, pattern{
				pkg:        parts[0],
				typ:        parts[1],
				args:       args,
				suggestion: key.to,
			})
		}

		var valueOf func(x ast.Expr) string
		valueOf = func(x ast.Expr) string {
			switch x := x.(type) {
			case *ast.Ident:
				return x.Name
			case *ast.SelectorExpr:
				id, ok := x.X.(*ast.Ident)
				if ok {
					return id.Name + "." + x.Sel.Name
				}
			case *ast.BasicLit:
				return x.Value
			case *ast.UnaryExpr:
				switch x.Op {
				case token.SUB:
					return "-" + valueOf(x.X)
				case token.ADD:
					return valueOf(x.X)
				}
			}
			return ""
		}

		findSuggestion := func(call *ast.CallExpr, pkg, typ string, patterns []pattern) string {
			for _, pat := range patterns {
				if pat.pkg != pkg || pat.typ != typ {
					continue
				}
				for _, arg := range pat.args {
					if arg.value == valueOf(call.Args[arg.index]) {
						return pat.suggestion
					}
				}
			}
			return ""
		}

		c := &wrapperFuncChecker{ctx: ctx}
		c.findSuggestion = func(call *ast.CallExpr) string {
			sel := astcast.ToSelectorExpr(call.Fun).Sel
			if sel == nil {
				return ""
			}
			x := astcast.ToSelectorExpr(call.Fun).X

			m := matchers[sel.Name]
			if m == nil {
				return ""
			}

			if x, ok := x.(*ast.Ident); ok {
				obj, ok := c.ctx.TypesInfo.ObjectOf(x).(*types.PkgName)
				if ok {
					return findSuggestion(call, obj.Name(), "", m.pkgPatterns)
				}
			}

			typ := c.ctx.TypesInfo.TypeOf(x)
			tn, ok := typ.(*types.Named)
			if !ok {
				return ""
			}
			return findSuggestion(
				call,
				tn.Obj().Pkg().Name(),
				tn.Obj().Name(),
				m.typPatterns)
		}

		return astwalk.WalkerForExpr(c)
	})
}

type wrapperFuncChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	findSuggestion func(*ast.CallExpr) string
}

func (c *wrapperFuncChecker) VisitExpr(expr ast.Expr) {
	call := astcast.ToCallExpr(expr)
	if len(call.Args) == 0 {
		return
	}

	if suggest := c.findSuggestion(call); suggest != "" {
		c.warn(call, suggest)
	}
}

func (c *wrapperFuncChecker) warn(cause ast.Node, suggest string) {
	c.ctx.Warn(cause, "use %s method in `%s`", suggest, cause)
}
