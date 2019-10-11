package astwalk

import (
	"go/types"

	"github.com/go-lintpack/lintpack"
)

// WalkerForFuncDecl returns file walker implementation for FuncDeclVisitor.
func WalkerForFuncDecl(v FuncDeclVisitor) lintpack.FileWalker {
	return &funcDeclWalker{visitor: v}
}

// WalkerForExpr returns file walker implementation for ExprVisitor.
func WalkerForExpr(v ExprVisitor) lintpack.FileWalker {
	return &exprWalker{visitor: v}
}

// WalkerForLocalExpr returns file walker implementation for LocalExprVisitor.
func WalkerForLocalExpr(v LocalExprVisitor) lintpack.FileWalker {
	return &localExprWalker{visitor: v}
}

// WalkerForStmtList returns file walker implementation for StmtListVisitor.
func WalkerForStmtList(v StmtListVisitor) lintpack.FileWalker {
	return &stmtListWalker{visitor: v}
}

// WalkerForStmt returns file walker implementation for StmtVisitor.
func WalkerForStmt(v StmtVisitor) lintpack.FileWalker {
	return &stmtWalker{visitor: v}
}

// WalkerForTypeExpr returns file walker implementation for TypeExprVisitor.
func WalkerForTypeExpr(v TypeExprVisitor, info *types.Info) lintpack.FileWalker {
	return &typeExprWalker{visitor: v, info: info}
}

// WalkerForLocalComment returns file walker implementation for LocalCommentVisitor.
func WalkerForLocalComment(v LocalCommentVisitor) lintpack.FileWalker {
	return &localCommentWalker{visitor: v}
}

// WalkerForComment returns file walker implementation for CommentVisitor.
func WalkerForComment(v CommentVisitor) lintpack.FileWalker {
	return &commentWalker{visitor: v}
}

// WalkerForDocComment returns file walker implementation for DocCommentVisitor.
func WalkerForDocComment(v DocCommentVisitor) lintpack.FileWalker {
	return &docCommentWalker{visitor: v}
}

// WalkerForLocalDef returns file walker implementation for LocalDefVisitor.
func WalkerForLocalDef(v LocalDefVisitor, info *types.Info) lintpack.FileWalker {
	return &localDefWalker{visitor: v, info: info}
}
