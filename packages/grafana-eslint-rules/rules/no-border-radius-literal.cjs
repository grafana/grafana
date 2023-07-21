// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/grafana/grafana#${name}`);

const borderRadiusRule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'css' &&
          node.arguments[0].type === 'ObjectExpression'
        ) {
          for (let property of node.arguments[0].properties) {
            if (
              property.type === AST_NODE_TYPES.Property &&
              property.key.type === AST_NODE_TYPES.Identifier &&
              property.key.name === 'borderRadius'
            ) {
              context.report({
                node: node.arguments[0],
                messageId: 'borderRadiusId',
              });
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
      recommended: false,
    },
    messages: {
      borderRadiusId: 'Custom values are not allowed for borderRadius. Use theme.shape tokens instead.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = borderRadiusRule;

