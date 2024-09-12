import { readFileSync } from 'fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'path';
import * as semver from 'semver';
import * as ts from 'typescript';

export interface TransformerOptions {}

const entry = resolve(process.cwd(), 'scripts/e2e-selectors/components2.ts');
const sourceFile = ts.createSourceFile(
  'components.ts',
  readFileSync(entry).toString(),
  ts.ScriptTarget.ES2015,
  /*setParentNodes */ true
);

const version = '11.3.0';

const getInitializedForVersion = (
  properties: ts.NodeArray<ts.ObjectLiteralElementLike>,
  escapedText: ts.__String
): ts.PropertyAssignment => {
  let current: ts.PropertyAssignment;
  for (const property of properties) {
    if (
      ts.isStringLiteral(property.name) &&
      ts.isPropertyAssignment(property) &&
      semver.satisfies(version, `>=${property.name.text}`)
    ) {
      try {
        if (!current) {
          current = property;
        } else if (semver.gt(property.name.text, current.name.getText())) {
          current = property;
        }
      } catch (error) {
        console.error('Could not parse version', property.name.text);
      }
    }
  }

  if (!current) {
    throw new Error(`Could not resolve a value for selector '${escapedText}' using version '${version}'`);
  }

  return current;
};

const replaceVersions = (context: ts.TransformationContext) => (rootNode: ts.Node) => {
  const visit = (node: ts.Node): ts.Node => {
    const newNode = ts.visitEachChild(node, visit, context);
    if (ts.isObjectLiteralExpression(newNode) && ts.isIdentifier(newNode.parent)) {
      const propertyAssignment = getInitializedForVersion(newNode.properties, newNode.parent.escapedText);
      if (!propertyAssignment) {
        return newNode;
      }

      if (
        propertyAssignment &&
        ts.isStringLiteral(propertyAssignment.name) &&
        ts.isStringLiteral(propertyAssignment.initializer)
      ) {
        return propertyAssignment.initializer;
      } else if (
        propertyAssignment &&
        ts.isStringLiteral(propertyAssignment.name) &&
        ts.isArrowFunction(propertyAssignment.initializer)
      ) {
        return propertyAssignment.initializer;
      }
    }

    return newNode;
  };

  return ts.visitNode(rootNode, visit);
};

const transformationResult = ts.transform(sourceFile, [replaceVersions]);
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const output = printer.printNode(
  ts.EmitHint.Unspecified,
  transformationResult.transformed[0],
  ts.createSourceFile('', '', ts.ScriptTarget.Latest)
);
console.log(output);
writeFile(resolve(process.cwd(), 'scripts/e2e-selectors/components.gen.ts'), output);
