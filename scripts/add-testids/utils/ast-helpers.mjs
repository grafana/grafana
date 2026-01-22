import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

// Handle ES module imports
const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

/**
 * Parse TypeScript/TSX file and return AST
 */
export function parseFile(content) {
  return parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
}

/**
 * Check if a JSX element matches target component names
 */
export function isTargetComponent(path, targetNames) {
  const name = path.node.name;

  if (t.isJSXIdentifier(name)) {
    return targetNames.includes(name.name);
  }

  if (t.isJSXMemberExpression(name)) {
    // Handle cases like <Icons.Menu />
    return targetNames.includes(name.property.name);
  }

  return false;
}

/**
 * Check if element already has data-testid attribute
 */
export function hasDataTestId(path) {
  return path.node.openingElement.attributes.some((attr) => {
    return t.isJSXAttribute(attr) && attr.name.name === 'data-testid';
  });
}

/**
 * Extract text content from JSX children
 */
export function extractTextContent(children) {
  if (!children || children.length === 0) return null;

  for (const child of children) {
    if (t.isJSXText(child)) {
      const text = child.value.trim();
      if (text) return text;
    }

    if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
      return child.expression.value;
    }
  }

  return null;
}

/**
 * Get prop value by name
 */
export function getPropValue(path, propName) {
  const attr = path.node.openingElement.attributes.find((attr) => {
    return t.isJSXAttribute(attr) && attr.name.name === propName;
  });

  if (!attr) return null;

  if (t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }

  if (t.isJSXExpressionContainer(attr.value)) {
    if (t.isStringLiteral(attr.value.expression)) {
      return attr.value.expression.value;
    }
  }

  return null;
}

/**
 * Get component name from JSX element
 */
export function getComponentName(path) {
  const name = path.node.openingElement.name;

  if (t.isJSXIdentifier(name)) {
    return name.name;
  }

  if (t.isJSXMemberExpression(name)) {
    return name.property.name;
  }

  return 'Unknown';
}

/**
 * Find parent component of a given path
 */
export function findParentComponent(path) {
  let parent = path.parentPath;

  while (parent) {
    if (parent.isJSXElement()) {
      return getComponentName(parent);
    }
    parent = parent.parentPath;
  }

  return null;
}

/**
 * Check if file imports from e2e-selectors
 */
export function hasE2ESelectorsImport(ast) {
  let hasImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === '@grafana/e2e-selectors') {
        hasImport = true;
        path.stop();
      }
    },
  });

  return hasImport;
}

/**
 * Add import for e2e-selectors if not present
 */
export function addE2ESelectorsImport(ast, importName = 'Components') {
  if (hasE2ESelectorsImport(ast)) {
    return ast;
  }

  const importDeclaration = t.importDeclaration(
    [t.importSpecifier(t.identifier(importName), t.identifier(importName))],
    t.stringLiteral('@grafana/e2e-selectors')
  );

  // Insert after existing imports
  let insertIndex = 0;
  traverse(ast, {
    ImportDeclaration(path) {
      const programBody = path.parentPath.node.body;
      const currentIndex = programBody.indexOf(path.node);
      if (currentIndex > insertIndex) {
        insertIndex = currentIndex;
      }
    },
  });

  ast.program.body.splice(insertIndex + 1, 0, importDeclaration);

  return ast;
}

/**
 * Generate code from AST
 */
export function generateCode(ast) {
  return generate(ast, {
    retainLines: false,
    compact: false,
  }).code;
}

/**
 * Create data-testid JSX attribute
 */
export function createDataTestIdAttribute(selectorPath) {
  // Parse selector path like "Components.Dashboard.Toolbar.saveButton"
  const parts = selectorPath.split('.');

  // Build member expression: Components.Dashboard.Toolbar.saveButton
  let memberExpression = t.identifier(parts[0]);

  for (let i = 1; i < parts.length; i++) {
    memberExpression = t.memberExpression(memberExpression, t.identifier(parts[i]));
  }

  return t.jsxAttribute(t.jsxIdentifier('data-testid'), t.jsxExpressionContainer(memberExpression));
}
