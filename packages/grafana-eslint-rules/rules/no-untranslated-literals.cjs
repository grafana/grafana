// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const noUntranslatedLiterals = createRule({
  create(context) {
    return {
      JSXElement(node) {
        if (node.hasOwnProperty('children')) {
          const children = node.children;
          if (children.length > 0) {
            children.forEach((child) => {
              // @ts-expect-error
              if((child.type === AST_NODE_TYPES.Literal || child.type === AST_NODE_TYPES.JSXText) && !isUsingTrans(node) && !isEmpty(child)) {
                context.report({
                  node: child,
                  messageId: 'noUntranslatedStrings',
                });
              }
            });
          }

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

module.exports = noUntranslatedLiterals;

// @ts-expect-error
const isEmpty = (node) => {
  let emptyString = false;
  if (typeof node.value === 'string' && (node.value.includes('\n') || node.value.length === 0)) {
    emptyString = true;
  }
  return emptyString;
};

// @ts-expect-error
const isUsingTrans = (node) => {
  const grandparent = node.parent;
  let isTranslated = false;
  if (
    grandparent.type === AST_NODE_TYPES.JSXElement &&
    node.type === AST_NODE_TYPES.JSXElement &&
    node.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
    node.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
    node.openingElement.name.name === "Trans"
  ) {
    isTranslated = true;
  }
  return isTranslated;
};

// https://astexplorer.net/#/gist/f121a2a9edea666731e75aae1d013c9d/01756ad7f809e63644c8d1acd2224f767267c05e
//
