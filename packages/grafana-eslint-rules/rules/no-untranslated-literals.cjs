// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const noUntranslatedLiterals = createRule({
  create(context) {
    return {
      JSXText(node) {
        const ancestors = context.getAncestors();
        const hasTransAncestor = ancestors.some((ancestor) => {
          return (
            ancestor.type === AST_NODE_TYPES.JSXElement &&
            ancestor.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
            ancestor.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
            ancestor.openingElement.name.name === 'Trans'
          );
        });
        if (!isEmpty(node.value) && !hasTransAncestor) {
          context.report({
            node,
            messageId: 'noUntranslatedStrings',
          });
        }
      },
    };
  },
  name: 'no-utranslated-strings',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Check untranslated strings',
    },
    messages: {
      noUntranslatedStrings: 'Please, mark strings for translation.',
    },
    schema: [],
  },
  defaultOptions: [],
});

// @ts-expect-error
const isEmpty = (val) => {
  return !Boolean(val.trim());
};

module.exports = noUntranslatedLiterals;
