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

package wire

import (
	"fmt"
	"go/ast"

	"golang.org/x/tools/go/ast/astutil"
)

// copyAST performs a deep copy of an AST. *ast.Ident identity will be
// preserved.
//
// This allows using astutil.Apply to rewrite an AST without modifying
// the original AST.
func copyAST(original ast.Node) ast.Node {
	// This function is necessarily long. No utility function exists to do this
	// clone, as most any attempt would need to have customization options, which
	// would need to be as expressive as Apply. A possibility to shorten the code
	// here would be to use reflection, but that trades clarity for shorter code.

	m := make(map[ast.Node]ast.Node)
	astutil.Apply(original, nil, func(c *astutil.Cursor) bool {
		switch node := c.Node().(type) {
		case nil:
			// No-op.
		case *ast.ArrayType:
			m[node] = &ast.ArrayType{
				Lbrack: node.Lbrack,
				Len:    exprFromMap(m, node.Len),
				Elt:    exprFromMap(m, node.Elt),
			}
		case *ast.AssignStmt:
			m[node] = &ast.AssignStmt{
				Lhs:    copyExprList(m, node.Lhs),
				TokPos: node.TokPos,
				Tok:    node.Tok,
				Rhs:    copyExprList(m, node.Rhs),
			}
		case *ast.BadDecl:
			m[node] = &ast.BadDecl{
				From: node.From,
				To:   node.To,
			}
		case *ast.BadExpr:
			m[node] = &ast.BadExpr{
				From: node.From,
				To:   node.To,
			}
		case *ast.BadStmt:
			m[node] = &ast.BadStmt{
				From: node.From,
				To:   node.To,
			}
		case *ast.BasicLit:
			m[node] = &ast.BasicLit{
				ValuePos: node.ValuePos,
				Kind:     node.Kind,
				Value:    node.Value,
			}
		case *ast.BinaryExpr:
			m[node] = &ast.BinaryExpr{
				X:     exprFromMap(m, node.X),
				OpPos: node.OpPos,
				Op:    node.Op,
				Y:     exprFromMap(m, node.Y),
			}
		case *ast.BlockStmt:
			m[node] = &ast.BlockStmt{
				Lbrace: node.Lbrace,
				List:   copyStmtList(m, node.List),
				Rbrace: node.Rbrace,
			}
		case *ast.BranchStmt:
			m[node] = &ast.BranchStmt{
				TokPos: node.TokPos,
				Tok:    node.Tok,
				Label:  identFromMap(m, node.Label),
			}
		case *ast.CallExpr:
			m[node] = &ast.CallExpr{
				Fun:      exprFromMap(m, node.Fun),
				Lparen:   node.Lparen,
				Args:     copyExprList(m, node.Args),
				Ellipsis: node.Ellipsis,
				Rparen:   node.Rparen,
			}
		case *ast.CaseClause:
			m[node] = &ast.CaseClause{
				Case:  node.Case,
				List:  copyExprList(m, node.List),
				Colon: node.Colon,
				Body:  copyStmtList(m, node.Body),
			}
		case *ast.ChanType:
			m[node] = &ast.ChanType{
				Begin: node.Begin,
				Arrow: node.Arrow,
				Dir:   node.Dir,
				Value: exprFromMap(m, node.Value),
			}
		case *ast.CommClause:
			m[node] = &ast.CommClause{
				Case:  node.Case,
				Comm:  stmtFromMap(m, node.Comm),
				Colon: node.Colon,
				Body:  copyStmtList(m, node.Body),
			}
		case *ast.Comment:
			m[node] = &ast.Comment{
				Slash: node.Slash,
				Text:  node.Text,
			}
		case *ast.CommentGroup:
			cg := new(ast.CommentGroup)
			if node.List != nil {
				cg.List = make([]*ast.Comment, len(node.List))
				for i := range node.List {
					cg.List[i] = m[node.List[i]].(*ast.Comment)
				}
			}
			m[node] = cg
		case *ast.CompositeLit:
			m[node] = &ast.CompositeLit{
				Type:   exprFromMap(m, node.Type),
				Lbrace: node.Lbrace,
				Elts:   copyExprList(m, node.Elts),
				Rbrace: node.Rbrace,
			}
		case *ast.DeclStmt:
			m[node] = &ast.DeclStmt{
				Decl: m[node.Decl].(ast.Decl),
			}
		case *ast.DeferStmt:
			m[node] = &ast.DeferStmt{
				Defer: node.Defer,
				Call:  callExprFromMap(m, node.Call),
			}
		case *ast.Ellipsis:
			m[node] = &ast.Ellipsis{
				Ellipsis: node.Ellipsis,
				Elt:      exprFromMap(m, node.Elt),
			}
		case *ast.EmptyStmt:
			m[node] = &ast.EmptyStmt{
				Semicolon: node.Semicolon,
				Implicit:  node.Implicit,
			}
		case *ast.ExprStmt:
			m[node] = &ast.ExprStmt{
				X: exprFromMap(m, node.X),
			}
		case *ast.Field:
			m[node] = &ast.Field{
				Doc:     commentGroupFromMap(m, node.Doc),
				Names:   copyIdentList(m, node.Names),
				Type:    exprFromMap(m, node.Type),
				Tag:     basicLitFromMap(m, node.Tag),
				Comment: commentGroupFromMap(m, node.Comment),
			}
		case *ast.FieldList:
			fl := &ast.FieldList{
				Opening: node.Opening,
				Closing: node.Closing,
			}
			if node.List != nil {
				fl.List = make([]*ast.Field, len(node.List))
				for i := range node.List {
					fl.List[i] = m[node.List[i]].(*ast.Field)
				}
			}
			m[node] = fl
		case *ast.ForStmt:
			m[node] = &ast.ForStmt{
				For:  node.For,
				Init: stmtFromMap(m, node.Init),
				Cond: exprFromMap(m, node.Cond),
				Post: stmtFromMap(m, node.Post),
				Body: blockStmtFromMap(m, node.Body),
			}
		case *ast.FuncDecl:
			m[node] = &ast.FuncDecl{
				Doc:  commentGroupFromMap(m, node.Doc),
				Recv: fieldListFromMap(m, node.Recv),
				Name: identFromMap(m, node.Name),
				Type: funcTypeFromMap(m, node.Type),
				Body: blockStmtFromMap(m, node.Body),
			}
		case *ast.FuncLit:
			m[node] = &ast.FuncLit{
				Type: funcTypeFromMap(m, node.Type),
				Body: blockStmtFromMap(m, node.Body),
			}
		case *ast.FuncType:
			m[node] = &ast.FuncType{
				Func:    node.Func,
				Params:  fieldListFromMap(m, node.Params),
				Results: fieldListFromMap(m, node.Results),
			}
		case *ast.GenDecl:
			decl := &ast.GenDecl{
				Doc:    commentGroupFromMap(m, node.Doc),
				TokPos: node.TokPos,
				Tok:    node.Tok,
				Lparen: node.Lparen,
				Rparen: node.Rparen,
			}
			if node.Specs != nil {
				decl.Specs = make([]ast.Spec, len(node.Specs))
				for i := range node.Specs {
					decl.Specs[i] = m[node.Specs[i]].(ast.Spec)
				}
			}
			m[node] = decl
		case *ast.GoStmt:
			m[node] = &ast.GoStmt{
				Go:   node.Go,
				Call: callExprFromMap(m, node.Call),
			}
		case *ast.Ident:
			// Keep identifiers the same identity so they can be conveniently
			// used with the original *types.Info.
			m[node] = node
		case *ast.IfStmt:
			m[node] = &ast.IfStmt{
				If:   node.If,
				Init: stmtFromMap(m, node.Init),
				Cond: exprFromMap(m, node.Cond),
				Body: blockStmtFromMap(m, node.Body),
				Else: stmtFromMap(m, node.Else),
			}
		case *ast.ImportSpec:
			m[node] = &ast.ImportSpec{
				Doc:     commentGroupFromMap(m, node.Doc),
				Name:    identFromMap(m, node.Name),
				Path:    basicLitFromMap(m, node.Path),
				Comment: commentGroupFromMap(m, node.Comment),
				EndPos:  node.EndPos,
			}
		case *ast.IncDecStmt:
			m[node] = &ast.IncDecStmt{
				X:      exprFromMap(m, node.X),
				TokPos: node.TokPos,
				Tok:    node.Tok,
			}
		case *ast.IndexExpr:
			m[node] = &ast.IndexExpr{
				X:      exprFromMap(m, node.X),
				Lbrack: node.Lbrack,
				Index:  exprFromMap(m, node.Index),
				Rbrack: node.Rbrack,
			}
		case *ast.InterfaceType:
			m[node] = &ast.InterfaceType{
				Interface:  node.Interface,
				Methods:    fieldListFromMap(m, node.Methods),
				Incomplete: node.Incomplete,
			}
		case *ast.KeyValueExpr:
			m[node] = &ast.KeyValueExpr{
				Key:   exprFromMap(m, node.Key),
				Colon: node.Colon,
				Value: exprFromMap(m, node.Value),
			}
		case *ast.LabeledStmt:
			m[node] = &ast.LabeledStmt{
				Label: identFromMap(m, node.Label),
				Colon: node.Colon,
				Stmt:  stmtFromMap(m, node.Stmt),
			}
		case *ast.MapType:
			m[node] = &ast.MapType{
				Map:   node.Map,
				Key:   exprFromMap(m, node.Key),
				Value: exprFromMap(m, node.Value),
			}
		case *ast.ParenExpr:
			m[node] = &ast.ParenExpr{
				Lparen: node.Lparen,
				X:      exprFromMap(m, node.X),
				Rparen: node.Rparen,
			}
		case *ast.RangeStmt:
			m[node] = &ast.RangeStmt{
				For:    node.For,
				Key:    exprFromMap(m, node.Key),
				Value:  exprFromMap(m, node.Value),
				TokPos: node.TokPos,
				Tok:    node.Tok,
				X:      exprFromMap(m, node.X),
				Body:   blockStmtFromMap(m, node.Body),
			}
		case *ast.ReturnStmt:
			m[node] = &ast.ReturnStmt{
				Return:  node.Return,
				Results: copyExprList(m, node.Results),
			}
		case *ast.SelectStmt:
			m[node] = &ast.SelectStmt{
				Select: node.Select,
				Body:   blockStmtFromMap(m, node.Body),
			}
		case *ast.SelectorExpr:
			m[node] = &ast.SelectorExpr{
				X:   exprFromMap(m, node.X),
				Sel: identFromMap(m, node.Sel),
			}
		case *ast.SendStmt:
			m[node] = &ast.SendStmt{
				Chan:  exprFromMap(m, node.Chan),
				Arrow: node.Arrow,
				Value: exprFromMap(m, node.Value),
			}
		case *ast.SliceExpr:
			m[node] = &ast.SliceExpr{
				X:      exprFromMap(m, node.X),
				Lbrack: node.Lbrack,
				Low:    exprFromMap(m, node.Low),
				High:   exprFromMap(m, node.High),
				Max:    exprFromMap(m, node.Max),
				Slice3: node.Slice3,
				Rbrack: node.Rbrack,
			}
		case *ast.StarExpr:
			m[node] = &ast.StarExpr{
				Star: node.Star,
				X:    exprFromMap(m, node.X),
			}
		case *ast.StructType:
			m[node] = &ast.StructType{
				Struct:     node.Struct,
				Fields:     fieldListFromMap(m, node.Fields),
				Incomplete: node.Incomplete,
			}
		case *ast.SwitchStmt:
			m[node] = &ast.SwitchStmt{
				Switch: node.Switch,
				Init:   stmtFromMap(m, node.Init),
				Tag:    exprFromMap(m, node.Tag),
				Body:   blockStmtFromMap(m, node.Body),
			}
		case *ast.TypeAssertExpr:
			m[node] = &ast.TypeAssertExpr{
				X:      exprFromMap(m, node.X),
				Lparen: node.Lparen,
				Type:   exprFromMap(m, node.Type),
				Rparen: node.Rparen,
			}
		case *ast.TypeSpec:
			m[node] = &ast.TypeSpec{
				Doc:     commentGroupFromMap(m, node.Doc),
				Name:    identFromMap(m, node.Name),
				Assign:  node.Assign,
				Type:    exprFromMap(m, node.Type),
				Comment: commentGroupFromMap(m, node.Comment),
			}
		case *ast.TypeSwitchStmt:
			m[node] = &ast.TypeSwitchStmt{
				Switch: node.Switch,
				Init:   stmtFromMap(m, node.Init),
				Assign: stmtFromMap(m, node.Assign),
				Body:   blockStmtFromMap(m, node.Body),
			}
		case *ast.UnaryExpr:
			m[node] = &ast.UnaryExpr{
				OpPos: node.OpPos,
				Op:    node.Op,
				X:     exprFromMap(m, node.X),
			}
		case *ast.ValueSpec:
			m[node] = &ast.ValueSpec{
				Doc:     commentGroupFromMap(m, node.Doc),
				Names:   copyIdentList(m, node.Names),
				Type:    exprFromMap(m, node.Type),
				Values:  copyExprList(m, node.Values),
				Comment: commentGroupFromMap(m, node.Comment),
			}
		default:
			panic(fmt.Sprintf("unhandled AST node: %T", node))
		}
		return true
	})
	return m[original]
}

func commentGroupFromMap(m map[ast.Node]ast.Node, key *ast.CommentGroup) *ast.CommentGroup {
	if key == nil {
		return nil
	}
	return m[key].(*ast.CommentGroup)
}

func exprFromMap(m map[ast.Node]ast.Node, key ast.Expr) ast.Expr {
	if key == nil {
		return nil
	}
	return m[key].(ast.Expr)
}

func stmtFromMap(m map[ast.Node]ast.Node, key ast.Stmt) ast.Stmt {
	if key == nil {
		return nil
	}
	return m[key].(ast.Stmt)
}

func identFromMap(m map[ast.Node]ast.Node, key *ast.Ident) *ast.Ident {
	if key == nil {
		return nil
	}
	return m[key].(*ast.Ident)
}

func blockStmtFromMap(m map[ast.Node]ast.Node, key *ast.BlockStmt) *ast.BlockStmt {
	if key == nil {
		return nil
	}
	return m[key].(*ast.BlockStmt)
}

func fieldListFromMap(m map[ast.Node]ast.Node, key *ast.FieldList) *ast.FieldList {
	if key == nil {
		return nil
	}
	return m[key].(*ast.FieldList)
}

func callExprFromMap(m map[ast.Node]ast.Node, key *ast.CallExpr) *ast.CallExpr {
	if key == nil {
		return nil
	}
	return m[key].(*ast.CallExpr)
}

func basicLitFromMap(m map[ast.Node]ast.Node, key *ast.BasicLit) *ast.BasicLit {
	if key == nil {
		return nil
	}
	return m[key].(*ast.BasicLit)
}

func funcTypeFromMap(m map[ast.Node]ast.Node, key *ast.FuncType) *ast.FuncType {
	if key == nil {
		return nil
	}
	return m[key].(*ast.FuncType)
}

func copyExprList(m map[ast.Node]ast.Node, exprs []ast.Expr) []ast.Expr {
	if exprs == nil {
		return nil
	}
	newExprs := make([]ast.Expr, len(exprs))
	for i := range exprs {
		newExprs[i] = m[exprs[i]].(ast.Expr)
	}
	return newExprs
}

func copyStmtList(m map[ast.Node]ast.Node, stmts []ast.Stmt) []ast.Stmt {
	if stmts == nil {
		return nil
	}
	newStmts := make([]ast.Stmt, len(stmts))
	for i := range stmts {
		newStmts[i] = m[stmts[i]].(ast.Stmt)
	}
	return newStmts
}

func copyIdentList(m map[ast.Node]ast.Node, idents []*ast.Ident) []*ast.Ident {
	if idents == nil {
		return nil
	}
	newIdents := make([]*ast.Ident, len(idents))
	for i := range idents {
		newIdents[i] = m[idents[i]].(*ast.Ident)
	}
	return newIdents
}
