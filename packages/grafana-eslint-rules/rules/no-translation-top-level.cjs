// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const isInFunction = (context, node) => {
  const ancestors = context.sourceCode.getAncestors(node);
  return ancestors.some((anc) => {
    return [
      AST_NODE_TYPES.ArrowFunctionExpression,
      AST_NODE_TYPES.FunctionDeclaration,
      AST_NODE_TYPES.FunctionExpression,
      AST_NODE_TYPES.ClassDeclaration,
    ].includes(anc.type);
  });
};

const noTranslationTopLevel = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.name === 't') {
          if (!isInFunction(context, node)) {
            context.report({
              node,
              messageId: 'noMethodOutsideComponent',
            });
          }
        }
      },
    };
  },
  name: 'no-translation-top-level',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not use translation functions outside of components',
    },
    messages: {
      noMethodOutsideComponent: 'Do not use the t() function outside of a component or function',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = noTranslationTopLevel;
