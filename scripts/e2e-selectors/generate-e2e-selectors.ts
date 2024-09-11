import { resolve } from 'path';
import * as ts from 'typescript';

const init = async () => {
  const entry = resolve(process.cwd(), 'scripts/e2e-selectors/components.ts');
  const program = ts.createProgram([entry], {
    allowSyntheticDefaultImports: true,
  });

  const sourceFile = program.getSourceFile(entry);
  const selectorRootNode = getSelectorsRootNode(sourceFile!);
  if (!selectorRootNode) {
    console.error('Could not find selectors root node');
    process.exit(1);
  }

  ts.forEachChild(selectorRootNode, (node) => {
    if (ts.isObjectLiteralElement(node)) {
      node.forEachChild((child) => {
        if (ts.isObjectLiteralElement(node)) {
        }
      });
    }
  });
};

const getSelectorsRootNode = (sourceFile: ts.SourceFile): ts.VariableDeclaration | null => {
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((declaration) => {
        if (
          ts.isVariableDeclaration(declaration)
          // ts.isIdentifier(declaration.getChildAt(0)) &&
          // ['components', 'pages', 'apis'].includes(declaration.name.escapedText.toString())
        ) {
          return declaration;
        }
      });
    }
  });

  return null;
};
