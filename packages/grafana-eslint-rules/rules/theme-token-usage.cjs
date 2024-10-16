// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`);

const themeTokenUsage = createRule({
  create(context) {
    return {
      Identifier: function (node) {
        if (node.name === 'theme') {
          const ancestors = context.sourceCode.getAncestors(node).reverse();
          const paths = [];
          let lastAncestor = null;
          for (const ancestor of ancestors) {
            if (
              ancestor.type === AST_NODE_TYPES.MemberExpression &&
              ancestor.property.type === AST_NODE_TYPES.Identifier
            ) {
              paths.push(ancestor.property.name);
              lastAncestor = ancestor;
            } else {
              break;
            }
          }
          if (paths.length > 0 && lastAncestor) {
            paths.unshift('theme');
            context.report({
              node: lastAncestor,
              messageId: 'themeTokenUsed',
              data: {
                identifier: paths.join('.'),
              },
            });
          }
        }
      },
    };
  },
  name: 'theme-token-usage',
  meta: {
    type: 'problem',
    docs: {
      description: 'Check for theme token usage',
    },
    messages: {
      themeTokenUsed: '{{ identifier }}',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = themeTokenUsage;
