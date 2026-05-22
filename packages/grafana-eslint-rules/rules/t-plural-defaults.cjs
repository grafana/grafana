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

function isEmptyStringLiteral(node) {
  if (!node) {
    return false;
  }
  if (node.type === AST_NODE_TYPES.Literal && node.value === '') {
    return true;
  }
  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0 &&
    node.quasis.length === 1 &&
    node.quasis[0].value.cooked === ''
  ) {
    return true;
  }
  return false;
}

const rule = createRule({
  create(context) {
    return {
      [`${AST_NODE_TYPES.CallExpression}[callee.type="Identifier"][callee.name="t"]`]: function (node) {
        if (node.arguments.length < 3) {
          return;
        }
        const positionalDefault = node.arguments[1];
        const options = node.arguments[2];
        if (!options || options.type !== AST_NODE_TYPES.ObjectExpression) {
          return;
        }

        if (options.properties.some((p) => p.type === AST_NODE_TYPES.SpreadElement)) {
          return;
        }

        const keyNames = options.properties.map(getPropertyKeyName);
        if (!keyNames.includes('count')) {
          return;
        }

        if (!isEmptyStringLiteral(positionalDefault)) {
          context.report({ node: positionalDefault, messageId: 'nonEmptyPositionalDefault' });
        }

        if (!keyNames.includes('defaultValue_one')) {
          context.report({ node: options, messageId: 'missingDefaultValueOne' });
        }

        if (!keyNames.includes('defaultValue_other')) {
          context.report({ node: options, messageId: 'missingDefaultValueOther' });
        }
      },
    };
  },
  name: 't-plural-defaults',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require t() calls that use a "count" option to put all plural defaults in defaultValue_one / defaultValue_other instead of the positional defaultValue argument.',
    },
    messages: {
      nonEmptyPositionalDefault:
        'When t() options include a "count" key, the positional defaultValue must be an empty string. Move the plural form into defaultValue_other.',
      missingDefaultValueOne:
        'When t() options include a "count" key, defaultValue_one must be provided in the options object.',
      missingDefaultValueOther:
        'When t() options include a "count" key, defaultValue_other must be provided in the options object.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;
