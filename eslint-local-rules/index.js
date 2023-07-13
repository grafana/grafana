module.exports = {
  'check-border-radius-tokens': {
    meta: {
      docs: {
        description: 'Check if border-radius theme tokens are used',
        category: 'Possible Errors',
        recommended: false,
      },
      schema: [],
    },
    create(context) {
      return {
        "CallExpression[callee.name='css']": (node) => {
          if (node.arguments[0].type === 'ObjectExpression') {
            const borderRadius = node.arguments[0].properties.find((property) => {
              return property.key.name === 'borderRadius';
            });
            if (borderRadius) {
              const borderRadiusIsLiteral = borderRadius.value.type === 'Literal';
              const borderRadiusUsesTheme =
                borderRadius.value.callee && borderRadius.value.callee.object.object.name === 'theme';
              const borderRadiusUsesShape =
                borderRadius.value.callee && borderRadius.value.callee.object.property.name === 'shape';
              if (borderRadiusIsLiteral || !borderRadiusUsesTheme || !borderRadiusUsesShape) {
                context.report(node.arguments[0], 'Custom values are not allowed for borderRadius. Use theme.shape tokens instead.');
              }
            }
          }
        },
      };
    },
  },
};
