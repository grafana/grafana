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

  if (!ts.isObjectLiteralExpression(selectorRootNode.initializer)) {
    console.error('Could not find selectors root node with object litteral');
    process.exit(1);
  }

  pumpUpTheMusic(selectorRootNode.initializer);
};

function pumpUpTheMusic(exp: ts.ObjectLiteralExpression) {
  // I think we need to break the loop when we have a match
  // since we are replacing parts of the tree...
  exp.forEachChild((node) => {
    if (ts.isPropertyAssignment(node)) {
      if (ts.isObjectLiteralExpression(node.initializer)) {
        return pumpUpTheMusic(node.initializer);
      }
      if (ts.isArrowFunction(node.initializer) && ts.isStringLiteral(node.name)) {
        return replaceChildrenWithSelector(exp);
      }
      if (ts.isStringLiteral(node.initializer) && ts.isStringLiteral(node.name)) {
        return replaceChildrenWithSelector(exp);
      }
    }
  });
}

function replaceChildrenWithSelector(ps: ts.ObjectLiteralExpression) {
  const [child] = ps.properties;
  if (ts.isPropertyAssignment(child)) {
    if (ts.isStringLiteral(child.name)) {
      console.log('replcae', child.name.text);
    }
  }
}

const getSelectorsRootNode = (sourceFile: ts.SourceFile): ts.VariableDeclaration | null => {
  let rootNode: ts.VariableDeclaration | null = null;

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    node.declarationList.declarations.forEach((declaration) => {
      if (!ts.isVariableDeclaration(declaration)) {
        return;
      }
      if (!ts.isIdentifier(declaration.name)) {
        return;
      }
      if (declaration.name.escapedText !== 'components') {
        return;
      }
      rootNode = declaration;
    });
  });

  return rootNode;
};

init();
