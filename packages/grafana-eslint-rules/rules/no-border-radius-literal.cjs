// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');


const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana#${name}`
);

const borderRadiusRule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'css' && node.arguments[0].type === 'ObjectExpression') {
          const borderRadius = node.arguments[0].properties.find((property) => {
            return property === 'borderRadius';
          });
          if (borderRadius && borderRadius.value.type === 'Literal') {
            context.report({
              node: node.arguments[0],
              messageId: 'borderRadiusId'
          });
          }
        }
      },
    };
  },
  name: 'no-border-radius-literal',
  meta: {
    docs: {
      description: 'Check if border-radius theme tokens are used',
      recommended: false,
    },
    messages: {
      borderRadiusId: 'Custom values are not allowed for borderRadius. Use theme.shape tokens instead.',
    },
    schema: [],
  }
});

module.exports = borderRadiusRule;

// module.exports = {
//   name: 'no-border-radius-literal',
//   meta: {
//     docs: {
//       description: 'Check if border-radius theme tokens are used',
//       category: 'Possible Errors',
//       recommended: false,
//     },
//     schema: [],
//   },
//   create(context) {
//     return {
//       "CallExpression[callee.name='css']": (node) => {
//         if (node.arguments[0].type === 'ObjectExpression') {
//           const borderRadius = node.arguments[0].properties.find((property) => {
//             return property.key?.name === 'borderRadius';
//           });
//           if (borderRadius && borderRadius.value.type === 'Literal') {
//             context.report(
//               node.arguments[0],
//               'Custom values are not allowed for borderRadius. Use theme.shape tokens instead.'
//             );
//           }
//         }
//       },
//     };
//   },
// };
