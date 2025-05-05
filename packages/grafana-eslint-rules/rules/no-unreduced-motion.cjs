// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const restrictedProperties = ['animation', 'transition'];

const isRestrictedProperty = (/** @type string */ propertyName) => {
  return restrictedProperties.some((prop) => propertyName.startsWith(prop));
};

const rule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'css') {
          const cssObjects = node.arguments.flatMap((node) => {
            switch (node.type) {
              case AST_NODE_TYPES.ObjectExpression:
                return [node];
              case AST_NODE_TYPES.ArrayExpression:
                return node.elements.filter((v) => v?.type === AST_NODE_TYPES.ObjectExpression);
              default:
                return [];
            }
          });

          for (const cssObject of cssObjects) {
            if (cssObject?.type === AST_NODE_TYPES.ObjectExpression) {
              for (const property of cssObject.properties) {
                if (
                  property.type === AST_NODE_TYPES.Property &&
                  property.key.type === AST_NODE_TYPES.Identifier &&
                  isRestrictedProperty(property.key.name)
                ) {
                  context.report({
                    node: property,
                    messageId: 'noUnreducedMotion',
                  });
                }
              }
            }
          }
        }
      },
    };
  },
  name: 'no-unreduced-motion',
  meta: {
    type: 'problem',
    docs: {
      description: 'Check if animation or transition properties are used directly.',
    },
    messages: {
      noUnreducedMotion:
        'Avoid direct use of `animation*` or `transition*` properties. Use the `handleMotion` utility function from theme.transitions or wrap in a `prefers-reduced-motion` media query.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;
