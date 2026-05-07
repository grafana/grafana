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

const RE_ZERO_VALUE = /^0([a-zA-Z%]*)$/;

const borderRadiusRule = createRule({
  create(context) {
    return {
      [`${AST_NODE_TYPES.CallExpression}[callee.name="css"] ${AST_NODE_TYPES.Property}`]: function (node) {
        if (
          node.type === AST_NODE_TYPES.Property &&
          node.key.type === AST_NODE_TYPES.Identifier &&
          BORDER_RADIUS_PROPERTIES.includes(node.key.name) &&
          node.value.type === AST_NODE_TYPES.Literal
        ) {
          const value = node.value.value;

          if (value === 'unset' || value === 'initial') {
            // Allow 'unset' or 'initial' to remove border radius
            return;
          } else if (value === 0 || RE_ZERO_VALUE.test(value)) {
            // Require 'unset' or 'initial' to remove border radius instead of `0` or `0px`
            context.report({
              node,
              messageId: 'borderRadiusNoZeroValue',
              fix(fixer) {
                return fixer.replaceText(node.value, "'unset'");
              },
            });
          } else {
            // Otherwise, require theme tokens are used
            context.report({
              node,
              messageId: 'borderRadiusUseTokens',
            });
          }
        }
      },
    };
  },
  name: 'no-border-radius-literal',
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Check if border-radius theme tokens are used',
    },
    messages: {
      borderRadiusUseTokens: 'Prefer using theme.shape.radius tokens instead of literal values.',
      borderRadiusNoZeroValue: 'Use unset or initial to remove a border radius.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = borderRadiusRule;
