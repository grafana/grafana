// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const trackingEventCreation = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'createEventFactory') {
          const args = node.arguments;
          const argsAreNotLiterals = args.some((arg) => arg.type !== AST_NODE_TYPES.Literal);

          if (argsAreNotLiterals) {
            return context.report({
              node,
              messageId: 'eventFactoryLiterals',
            });
          }
        }
      },
      ImportSpecifier(node) {
        if (node.type === AST_NODE_TYPES.ImportSpecifier && node.imported.type === AST_NODE_TYPES.Identifier && node.imported.name === 'createEventFactory') {
          const importedAs = node.local.name;
          if (!importedAs) {
            return;
          }
          const variablesDeclared = context.sourceCode.ast.body.filter((node) => node.type === AST_NODE_TYPES.VariableDeclaration);
          if (variablesDeclared.length > 0) {
            variablesDeclared.map((variable) => {
              const variableType = variable.declarations[0].type;
              const variableCallsFunction = variable.declarations[0]?.init?.type;
              if (variableType === AST_NODE_TYPES.VariableDeclarator && variableCallsFunction === AST_NODE_TYPES.CallExpression) {
                const variableName = variable.declarations[0].init?.callee.type === AST_NODE_TYPES.Identifier && variable.declarations[0].init?.callee?.name;
                if (variableName && variableName === importedAs) {
                  const args = variable.declarations[0].init?.arguments;
                  const argsAreNotLiterals = args && args.some((arg) => arg.type !== AST_NODE_TYPES.Literal);

                  if (argsAreNotLiterals) {
                    return context.report({
                      node,
                      messageId: 'eventFactoryLiterals',
                    });
                  }
                }
              }
            });
          }
        }
      },
    };
  },
  name: 'tracking-event-creation',
  meta: {
    type: 'problem',
    docs: {
      description: 'Check that the tracking event is created in the right way',
    },
    messages: {
      eventFactoryLiterals: 'Params passed to `createEventFactory` must be literals',
    },
    schema: [],
  },

  defaultOptions: [],
});

module.exports = trackingEventCreation;
