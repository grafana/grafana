// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const borderRadiusRule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'css') {
          const cssObjects = node.arguments.flatMap((node) => {
            switch (node.type) {
              case AST_NODE_TYPES.ObjectExpression:
                return [node];
              case AST_NODE_TYPES.ArrayExpression:
                return node.elements.filter((v) => v?.type === AST_NODE_TYPES.ObjectExpression);
              default:
                return [];
            }
          });

          for (const cssObject of cssObjects) {
            if (cssObject?.type === AST_NODE_TYPES.ObjectExpression) {
              for (const property of cssObject.properties) {
                if (
                  property.type === AST_NODE_TYPES.Property &&
                  property.key.type === AST_NODE_TYPES.Identifier &&
                  property.key.name === 'borderRadius' &&
                  property.value.type === AST_NODE_TYPES.Literal
                ) {
                  context.report({
                    node: property,
                    messageId: 'borderRadiusId',
                  });
                }
              }
            }
          }
        }
      },
    };
  },
  name: 'no-border-radius-literal',
  meta: {
    type: 'problem',
    docs: {
      description: 'Check if border-radius theme tokens are used',
    },
    messages: {
      borderRadiusId: 'Prefer using theme.shape.radius tokens instead of literal values.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = borderRadiusRule;
