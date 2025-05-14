const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const borderRadiusRule = createRule({
  create(context) {
    return {
      [`${AST_NODE_TYPES.CallExpression}[callee.name="css"] ${AST_NODE_TYPES.Property}`]: function (node) {
        if (
          node.type === AST_NODE_TYPES.Property &&
          node.key.type === AST_NODE_TYPES.Identifier &&
          node.key.name === 'borderRadius' &&
          node.value.type === AST_NODE_TYPES.Literal
        ) {
          context.report({
            node,
            messageId: 'borderRadiusId',
          });
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
