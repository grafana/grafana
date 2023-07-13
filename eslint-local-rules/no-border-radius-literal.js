module.exports = {
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
            return property.key?.name === 'borderRadius';
          });
          if (borderRadius && borderRadius.value.type === 'Literal') {
            context.report(
              node.arguments[0],
              'Custom values are not allowed for borderRadius. Use theme.shape tokens instead.'
            );
          }
        }
      },
    };
  },
};
