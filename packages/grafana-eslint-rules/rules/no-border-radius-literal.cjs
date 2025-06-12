const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const BORDER_RADIUS_PROPERTIES = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
];

function isValidBorderRadiusLiteralValue(node) {
  if (node.type !== AST_NODE_TYPES.Literal) {
    return true;
  }

  if (node.value === 0 || node.value === '0px') {
    return true;
  }

  return false;
}

const borderRadiusRule = createRule({
  create(context) {
    return {
      [`${AST_NODE_TYPES.CallExpression}[callee.name="css"] ${AST_NODE_TYPES.Property}`]: function (node) {
        if (
          node.type === AST_NODE_TYPES.Property &&
          node.key.type === AST_NODE_TYPES.Identifier &&
          BORDER_RADIUS_PROPERTIES.includes(node.key.name) &&
          !isValidBorderRadiusLiteralValue(node.value)
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
