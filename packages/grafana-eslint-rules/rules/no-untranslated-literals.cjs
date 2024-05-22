// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const noUntranslatedLiterals = createRule({
  create(context) {
    return {
      Literal(node) {
        if (node.value && isEmpty(node.value)) {
          return;
        }
        const ancestors = context.getAncestors();
        const hasTransAncestor = ancestors.some((ancestor) => {
          return (
            ancestor.type === AST_NODE_TYPES.JSXElement &&
            ancestor.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
            ancestor.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
            ancestor.openingElement.name.name === 'Trans'
          );
        });
        if (getValidation(node) && hasJSXElementParentOrGrandParent(node) && !hasTransAncestor) {
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

module.exports = noUntranslatedLiterals;

// @ts-expect-error
const getValidation = (node) => {
  const parent = getParentIgnoringBinaryExpressions(node);

  function isParentNodeStandard() {
    if (!/^[\s]+$/.test(node.value) && typeof node.value === 'string' && parent.type.includes('JSX')) {
      return parent.type !== AST_NODE_TYPES.JSXAttribute;
    }

    return false;
  }

  const standard = isParentNodeStandard();

  return standard && parent.type !== AST_NODE_TYPES.JSXExpressionContainer;
};
// @ts-expect-error
const getParentAndGrandParentType = (node) => {
  const parent = getParentIgnoringBinaryExpressions(node);
  const parentType = parent.type;
  const grandParentType = parent.parent.type;

  return {
    parent,
    parentType,
    grandParentType,
    grandParent: parent.parent,
  };
};

// @ts-expect-error
const hasJSXElementParentOrGrandParent = (node) => {
  const parents = getParentAndGrandParentType(node);
  const parentType = parents.parentType;
  const grandParentType = parents.grandParentType;

  return parentType === AST_NODE_TYPES.JSXFragment || parentType === AST_NODE_TYPES.JSXElement || grandParentType === AST_NODE_TYPES.JSXElement;
};


// @ts-expect-error
const getParentIgnoringBinaryExpressions = (node) => {
  let current = node;
  while (current.parent.type === AST_NODE_TYPES.BinaryExpression) {
    current = current.parent;
  }
  return current.parent;
};

// @ts-expect-error
const isEmpty = (val) => {
  let result = false;
  if (typeof val === 'string') {
    const cleaned = val.replaceAll(/\s/g, '').replaceAll(/[\n]/g, '');
    result = cleaned.length === 0;
  }
  return result;
};
