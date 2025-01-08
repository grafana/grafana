// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const propsToCheck = ['label', 'description', 'placeholder', 'aria-label', 'title', 'text'];

const noUntranslatedStrings = createRule({
  create(context) {
    return {
      JSXAttribute(node) {
        if (!propsToCheck.includes(String(node.name.name)) || !node.value) {
          return;
        }

        const isUntranslatedProp =
          (node.value.type === 'Literal' && node.value.value !== '') ||
          (node.value.type === 'JSXExpressionContainer' && node.value.expression.type === 'Literal');

        if (isUntranslatedProp) {
          return context.report({
            node,
            messageId: 'noUntranslatedStringsProp',
          });
        }
      },
      JSXText(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const isEmpty = !node.value.trim();
        const hasTransAncestor = ancestors.some((ancestor) => {
          return (
            ancestor.type === AST_NODE_TYPES.JSXElement &&
            ancestor.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
            ancestor.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
            ancestor.openingElement.name.name === 'Trans'
          );
        });
        if (!isEmpty && !hasTransAncestor) {
          context.report({
            node,
            messageId: 'noUntranslatedStrings',
          });
        }
      },
    };
  },
  name: 'no-untranslated-strings',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Check untranslated strings',
    },
    messages: {
      noUntranslatedStrings: 'No untranslated strings. Wrap text with <Trans />',
      noUntranslatedStringsProp: `No untranslated strings in text props. Wrap text with <Trans /> or use t()`,
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = noUntranslatedStrings;
