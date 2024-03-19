package generators

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	
	"github.com/dave/dst"
	"github.com/dave/dst/dstutil"
)

// depointerizer returns an AST manipulator that removes redundant
// pointer indirection from the defined types.
func depointerizer() dstutil.ApplyFunc {
	return func(c *dstutil.Cursor) bool {
		switch x := c.Node().(type) {
		case *dst.Field:
			if s, is := x.Type.(*dst.StarExpr); is {
				switch deref := depoint(s).(type) {
				case *dst.ArrayType, *dst.MapType:
					x.Type = deref
				}
			}
		}
		return true
	}
}

func depoint(e dst.Expr) dst.Expr {
	if star, is := e.(*dst.StarExpr); is {
		return star.X
	}
	return e
}

func setStar(e dst.Expr) string {
	if _, is := e.(*dst.StarExpr); is {
		return "*"
	}
	return ""
}

func fixTODOComments() dstutil.ApplyFunc {
	return func(cursor *dstutil.Cursor) bool {
		switch f := cursor.Node().(type) {
		case *dst.File:
			for _, d := range f.Decls {
				if isTypeSpec(d) {
					removeGoFieldComment(d.Decorations().Start.All())
				}
				fixTODOComment(d.Decorations().Start.All())
			}
		case *dst.Field:
			if len(f.Names) > 0 {
				removeGoFieldComment(f.Decorations().Start.All())
			}
		}

		return true
	}
}

func fixTODOComment(comments []string) {
	todoRegex := regexp.MustCompile("(//) (.*) (TODO.*)")
	if len(comments) > 0 {
		comments[0] = todoRegex.ReplaceAllString(comments[0], "$1 $3")
	}
}

func removeGoFieldComment(comments []string) {
	todoRegex := regexp.MustCompile("(//) ([A-Z].*?) ([A-Z]?.*?) (.*)")
	if len(comments) > 0 {
		matches := todoRegex.FindAllStringSubmatch(comments[0], -1)
		if len(matches) > 0 {
			if strings.EqualFold(matches[0][3], matches[0][2]) {
				comments[0] = fmt.Sprintf("%s %s %s", matches[0][1], matches[0][3], matches[0][4])
			} else {
				r := []rune(matches[0][3])
				if !unicode.IsLower(r[0]) {
					comments[0] = fmt.Sprintf("%s %s %s", matches[0][1], matches[0][3], matches[0][4])
				}
			}
		}
	}
}

func isTypeSpec(d dst.Decl) bool {
	gd, ok := d.(*dst.GenDecl)
	if !ok {
		return false
	}

	_, is := gd.Specs[0].(*dst.TypeSpec)
	return is
}

// It fixes the "generic" fields. It happens when a value in cue could be different structs.
// For Go it generates a struct with a json.RawMessage field inside and multiple functions to map it between the different possibilities.
func fixRawData() dstutil.ApplyFunc {
	return func(c *dstutil.Cursor) bool {
		f, is := c.Node().(*dst.File)
		if !is {
			return false
		}

		rawFields := make(map[string]bool)
		existingRawFields := make(map[string]bool)
		for _, decl := range f.Decls {
			switch x := decl.(type) {
			// Find the structs that only contains one json.RawMessage inside
			case *dst.GenDecl:
				for _, t := range x.Specs {
					if ts, ok := t.(*dst.TypeSpec); ok {
						if tp, ok := ts.Type.(*dst.StructType); ok && len(tp.Fields.List) == 1 {
							if fn, ok := tp.Fields.List[0].Type.(*dst.SelectorExpr); ok {
								if fmt.Sprintf("%s.%s", fn.X, fn.Sel.Name) == "json.RawMessage" {
									rawFields[ts.Name.Name] = true
								}
							}
						}
					}
				}
			// Find the functions of the previous structs to verify that are the ones that we are looking for.
			case *dst.FuncDecl:
				for _, recv := range x.Recv.List {
					fnType := depoint(recv.Type).(*dst.Ident).Name
					if rawFields[fnType] {
						existingRawFields[fnType] = true
					}
				}
			}
		}

		dstutil.Apply(f, func(c *dstutil.Cursor) bool {
			switch x := c.Node().(type) {
			// Delete the functions
			case *dst.FuncDecl:
				c.Delete()
			case *dst.GenDecl:
				// Deletes all "generics" generated for these json.RawMessage structs
				comments := x.Decorations().Start.All()
				if len(comments) > 0 {
					if strings.HasSuffix(comments[0], "defines model for .") {
						c.Delete()
					}
				}
				for _, spec := range x.Specs {
					if tp, ok := spec.(*dst.TypeSpec); ok {
						// Delete structs with only json.RawMessage
						if existingRawFields[tp.Name.Name] && tp.Name.Name != "MetricAggregation2" {
							c.Delete()
							continue
						}
						// Set types that was using these structs as interface{}
						if st, ok := tp.Type.(*dst.StructType); ok {
							iterateStruct(st, withoutRawData(existingRawFields))
						}
						if mt, ok := tp.Type.(*dst.MapType); ok {
							iterateMap(mt, withoutRawData(existingRawFields))
						}
						if at, ok := tp.Type.(*dst.ArrayType); ok {
							iterateArray(at, withoutRawData(existingRawFields))
						}
					}
				}
			}
			return true
		}, nil)

		return true
	}
}

// Fixes type name containing underscores in the generated Go files
func fixUnderscoreInTypeName() dstutil.ApplyFunc {
	return func(c *dstutil.Cursor) bool {
		switch x := c.Node().(type) {
		case *dst.GenDecl:
			if specs, isType := x.Specs[0].(*dst.TypeSpec); isType {
				if strings.Contains(specs.Name.Name, "_") {
					oldName := specs.Name.Name
					specs.Name.Name = strings.ReplaceAll(specs.Name.Name, "_", "")
					x.Decs.Start[0] = strings.ReplaceAll(x.Decs.Start[0], oldName, specs.Name.Name)
				}
				if st, ok := specs.Type.(*dst.StructType); ok {
					iterateStruct(st, withoutUnderscore)
				}
				if mt, ok := specs.Type.(*dst.MapType); ok {
					iterateMap(mt, withoutUnderscore)
				}
				if at, ok := specs.Type.(*dst.ArrayType); ok {
					iterateArray(at, withoutUnderscore)
				}
			}
		case *dst.Field:
			findFieldsWithUnderscores(x)
		}
		return true
	}
}

func findFieldsWithUnderscores(x *dst.Field) {
	switch t := x.Type.(type) {
	case *dst.Ident:
		withoutUnderscore(t)
	case *dst.StarExpr:
		if i, is := t.X.(*dst.Ident); is {
			withoutUnderscore(i)
		}
	case *dst.ArrayType:
		iterateArray(t, withoutUnderscore)
	case *dst.MapType:
		iterateMap(t, withoutUnderscore)
	}
}

func withoutUnderscore(i *dst.Ident) {
	if strings.Contains(i.Name, "_") {
		i.Name = strings.ReplaceAll(i.Name, "_", "")
	}
}

func withoutRawData(existingFields map[string]bool) func(ident *dst.Ident) {
	return func(i *dst.Ident) {
		if existingFields[i.Name] {
			i.Name = setStar(i) + "any"
		}
	}
}

func iterateStruct(s *dst.StructType, fn func(i *dst.Ident)) {
	for i, f := range s.Fields.List {
		switch mx := depoint(f.Type).(type) {
		case *dst.Ident:
			fn(mx)
		case *dst.ArrayType:
			iterateArray(mx, fn)
		case *dst.MapType:
			iterateMap(mx, fn)
		case *dst.StructType:
			iterateStruct(mx, fn)
		case *dst.InterfaceType:
			s.Fields.List[i].Type = interfaceToAny(f.Type)
		}
	}
}

func iterateMap(s *dst.MapType, fn func(i *dst.Ident)) {
	switch mx := s.Value.(type) {
	case *dst.Ident:
		fn(mx)
	case *dst.ArrayType:
		iterateArray(mx, fn)
	case *dst.MapType:
		iterateMap(mx, fn)
	case *dst.InterfaceType:
		s.Value = interfaceToAny(s.Value)
	}
}

func iterateArray(a *dst.ArrayType, fn func(i *dst.Ident)) {
	switch mx := a.Elt.(type) {
	case *dst.Ident:
		fn(mx)
	case *dst.ArrayType:
		iterateArray(mx, fn)
	case *dst.StructType:
		iterateStruct(mx, fn)
	case *dst.InterfaceType:
		a.Elt = interfaceToAny(a.Elt)
	}
}

func interfaceToAny(i dst.Expr) dst.Expr {
	star := ""
	if _, is := i.(*dst.StarExpr); is {
		star = "*"
	}

	return &dst.Ident{Name: star + "any"}
}
