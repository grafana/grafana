// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const noUntranslatedLiterals = createRule({
  create(context) {
    return {
      Literal: (node) => {
        if (isEmpty(node)
        || isInterfaceOrType(node)
        || isVariable(node)
        || isReturnStatement(node)
        || isImportStatement(node)
        || isBinaryExpression(node)
        || isUsingTrans(node)
        || isAttributeOrProp(node)
        || isReturnStatement(node)

        )
        {
          return;
        }


        context.report({
          node,
          messageId: 'noUntranslatedStrings',
        });
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
const isImportStatement = (node) => { 
  const parent = node.parent;
  if (parent && parent.type === AST_NODE_TYPES.ImportDeclaration) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isAttributeOrProp = (node) => {
  const parent = node.parent;
  const grandparent = parent.parent;
  if (parent.type === AST_NODE_TYPES.JSXAttribute || grandparent.type === AST_NODE_TYPES.JSXAttribute ||
    parent.type === AST_NODE_TYPES.Property || grandparent.type === AST_NODE_TYPES.Property
  ) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isBinaryExpression = (node) => {
  const parent = node.parent;
  if (parent && parent.type === AST_NODE_TYPES.BinaryExpression) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isInterfaceOrType = (node) => {
  const parent = node.parent;
  if (parent && parent.type === AST_NODE_TYPES.TSInterfaceDeclaration || parent.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isVariable = (node) => {
  const parent = node.parent;
  const grandparent = parent.parent;

  if (parent && parent.type === AST_NODE_TYPES.VariableDeclaration || grandparent && grandparent.type === AST_NODE_TYPES.VariableDeclaration
    || parent && parent.type === AST_NODE_TYPES.VariableDeclarator || grandparent && grandparent.type === AST_NODE_TYPES.VariableDeclarator 
    || parent && parent.type === AST_NODE_TYPES.AssignmentExpression || grandparent && grandparent.type === AST_NODE_TYPES.AssignmentExpression
  ) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isReturnStatement = (node) => {
  const parent = node.parent;
  if (parent && parent.type === AST_NODE_TYPES.ReturnStatement) {
    return true;
  } else {
    return false;
  }
}

// @ts-expect-error
const isUsingTrans = (node) => {
  const parent = node.parent;
  const grandparent = parent.parent;
  let isTranslated = false;
  if (
    parent.type === AST_NODE_TYPES.JSXAttribute &&
    parent.name.type === AST_NODE_TYPES.JSXIdentifier &&
    parent.name.name === 'i18nKey' &&
    grandparent.name.type === AST_NODE_TYPES.JSXOpeningElement &&
    grandparent.name.name === 'Trans'
  ) {
    isTranslated = true;
  }
  return isTranslated;
};

// https://astexplorer.net/#/gist/f121a2a9edea666731e75aae1d013c9d/01756ad7f809e63644c8d1acd2224f767267c05e
//
