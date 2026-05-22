const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

function getPropertyKeyName(prop) {
  if (prop.type !== AST_NODE_TYPES.Property) {
    return null;
  }
  if (prop.key.type === AST_NODE_TYPES.Identifier) {
    return prop.key.name;
  }
  if (prop.key.type === AST_NODE_TYPES.Literal && typeof prop.key.value === 'string') {
    return prop.key.value;
  }
  return null;
}

function findAttribute(openingElement, name) {
  for (const attr of openingElement.attributes) {
    if (
      attr.type === AST_NODE_TYPES.JSXAttribute &&
      attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
      attr.name.name === name
    ) {
      return attr;
    }
  }
  return null;
}

function attributeValueExpression(attr) {
  if (!attr || !attr.value) {
    return null;
  }
  if (attr.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return attr.value.expression;
  }
  return attr.value;
}

const rule = createRule({
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== AST_NODE_TYPES.JSXIdentifier || node.name.name !== 'Trans') {
          return;
        }

        if (node.attributes.some((a) => a.type === AST_NODE_TYPES.JSXSpreadAttribute)) {
          return;
        }

        const countAttr = findAttribute(node, 'count');
        const valuesAttr = findAttribute(node, 'values');

        let hasCount = countAttr !== null;
        if (!hasCount && valuesAttr) {
          const valuesExpr = attributeValueExpression(valuesAttr);
          if (!valuesExpr) {
            return;
          }
          if (valuesExpr.type !== AST_NODE_TYPES.ObjectExpression) {
            return;
          }
          if (valuesExpr.properties.some((p) => p.type === AST_NODE_TYPES.SpreadElement)) {
            return;
          }
          hasCount = valuesExpr.properties.some((p) => getPropertyKeyName(p) === 'count');
        }

        if (!hasCount) {
          return;
        }

        const tOptionsAttr = findAttribute(node, 'tOptions');
        if (!tOptionsAttr) {
          context.report({ node, messageId: 'missingTOptions' });
          context.report({ node, messageId: 'missingDefaultValueOne' });
          context.report({ node, messageId: 'missingDefaultValueOther' });
          return;
        }

        const tOptionsExpr = attributeValueExpression(tOptionsAttr);
        if (!tOptionsExpr || tOptionsExpr.type !== AST_NODE_TYPES.ObjectExpression) {
          return;
        }
        if (tOptionsExpr.properties.some((p) => p.type === AST_NODE_TYPES.SpreadElement)) {
          return;
        }

        const tOptionsKeys = tOptionsExpr.properties.map(getPropertyKeyName);
        if (!tOptionsKeys.includes('defaultValue_one')) {
          context.report({ node: tOptionsExpr, messageId: 'missingDefaultValueOne' });
        }
        if (!tOptionsKeys.includes('defaultValue_other')) {
          context.report({ node: tOptionsExpr, messageId: 'missingDefaultValueOther' });
        }
      },
    };
  },
  name: 'trans-plural-defaults',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <Trans> elements that pass count (directly or via the values prop) to carry a tOptions prop with defaultValue_one and defaultValue_other.',
    },
    messages: {
      missingTOptions:
        'A <Trans> component that uses "count" must declare a tOptions prop with defaultValue_one and defaultValue_other.',
      missingDefaultValueOne:
        'A <Trans> component that uses "count" must declare defaultValue_one inside its tOptions prop.',
      missingDefaultValueOther:
        'A <Trans> component that uses "count" must declare defaultValue_other inside its tOptions prop.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;
