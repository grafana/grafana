// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * @typedef {import("@typescript-eslint/types/dist/generated/ast-spec").Expression} Expression
 * @typedef {import("@typescript-eslint/types/dist/generated/ast-spec").JSXEmptyExpression } JSXEmptyExpression
 * @typedef {import("@typescript-eslint/types/dist/generated/ast-spec").PrivateIdentifier } PrivateIdentifier
 * @typedef {import("@typescript-eslint/types/dist/generated/ast-spec").MemberExpressionComputedName } MemberExpressionComputedName
 * @typedef {import("@typescript-eslint/types/dist/generated/ast-spec").MemberExpressionNonComputedName } MemberExpressionNonComputedName
 * @typedef {import('@typescript-eslint/types/dist/generated/ast-spec').Identifier} Identifier
 *
 * @typedef {import("@typescript-eslint/utils/dist/ts-eslint/Scope").Scope.Scope } Scope
 * @typedef {import("@typescript-eslint/utils/dist/ts-eslint/Scope").Scope.Variable } Variable
 */

const GRAFANA_E2E_PACKAGE_NAME = '@grafana/e2e-selectors';

const createRule = ESLintUtils.RuleCreator(
  // TODO: find a proper url?
  (name) => `https://github.com/grafana/grafana#${name}`
);

// A relative simple lint rule that will look of the `selectors` export from @grafana/e2e-selectors
// is used in an aria-label
// There's probably a few ways around this, but the point isn't to be exhaustive but to find the
// majority of instances to count them
const rule = createRule({
  create(context) {
    return {
      JSXAttribute(node) {
        // Only inspect aria-label props
        if (node.name.name !== 'aria-label' || !node.value) {
          return;
        }

        // We're only interested in props with expression values (aria-label={...})
        // This allows all simple strings
        if (node.value.type !== 'JSXExpressionContainer') {
          return;
        }

        const identifiers = findIdentifiers(node.value.expression);

        for (const identifier of identifiers) {
          const scope = context.getScope();

          // Find the actual "scoped variable" to inspect it's import
          // This is relatively fragile, and will fail to find the import if the variable is reassigned
          const variable = findVariableInScope(scope, identifier.name);
          const importDef = variable?.defs.find(
            (v) =>
              v.type === 'ImportBinding' &&
              v.parent.type === 'ImportDeclaration' &&
              v.parent.source.value === GRAFANA_E2E_PACKAGE_NAME
          );

          if (importDef) {
            context.report({
              messageId: 'useDataTestId',
              node,
            });
          }
        }
      },
    };
  },

  name: 'no-aria-label-selectors',
  meta: {
    docs: {
      description: 'aria-label should not contain e2e selectors',
      recommended: 'error',
    },
    messages: {
      useDataTestId: 'Use data-testid for E2E selectors instead of aria-label',
    },
    type: 'suggestion',
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;

/**
 * Finds identifiers (variables) mentioned in various types of expressions:
 *  - Identifier: `selectors` -> `selectors`
 *  - MemberExpression: `selectors.foo.bar` -> `selectors`
 *  - CallExpression:   `selectors.foo.bar()` -> `selectors`
 *  - BinaryExpression: `"hello" + selectors.foo.bar` -> `selectors`
 *  - TemplateLiteral: ``hello ${selectors.foo.bar}`` -> `selectors`
 *
 *  Unsupported expressions will just silently not return anything (rather than crashing eslint)
 *
 * @param { Expression | JSXEmptyExpression | PrivateIdentifier } node
 * @returns { Array.<Identifier> }
 */
function findIdentifiers(node /* JSXEmptyExpression | Expression */) {
  if (node.type === 'Identifier') {
    return [node];
  } else if (node.type === 'MemberExpression') {
    return [getIdentifierFromMemberExpression(node)];
  } else if (node.type === 'CallExpression') {
    return findIdentifiers(node.callee);
  } else if (node.type === 'BinaryExpression') {
    return [...findIdentifiers(node.left), ...findIdentifiers(node.right)].filter(Boolean);
  } else if (node.type === 'TemplateLiteral') {
    return node.expressions.flatMap((v) => findIdentifiers(v)).filter(Boolean);
  }

  return [];
}

/**
 * Given a MemberExpression (`selectors.foo.bar.baz`) recursively follow children to
 * find the 'root' Identifier (`selectors`)
 *
 * @param { MemberExpressionNonComputedName | MemberExpressionComputedName } node
 * @returns { Identifier }
 */
function getIdentifierFromMemberExpression(node) {
  if (node.object.type === 'Identifier') {
    return node.object;
  } else if (node.object.type === 'MemberExpression') {
    return getIdentifierFromMemberExpression(node.object);
  } else {
    throw new Error('unknown object type');
  }
}

/**
 * @param { Scope } initialScope
 * @param { string } variableName
 * @returns { Variable | undefined }
 */
function findVariableInScope(initialScope, variableName) {
  /** @type {Scope | null} */
  let scope = initialScope;

  while (scope !== null) {
    const variable = scope.set.get(variableName);
    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }
}
