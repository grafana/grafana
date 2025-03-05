// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const trackingEventCreation = createRule({
  create(context) {
    return {
      CallExpression(node) {
        //1.Looking for createEventFactory function
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'createEventFactory') {
          //Check if the arguments are literals
          const args = node.arguments;
          const argsAreNotLiterals = args.some((arg) => arg.type !== AST_NODE_TYPES.Literal);
          //If some of them are not literals, report
          if (argsAreNotLiterals) {
            return context.report({
              node,
              messageId: 'eventFactoryLiterals',
            });
          }
          //2. Check if the event function has a comments
          const parent = node.parent;
          if (parent && parent.type === AST_NODE_TYPES.VariableDeclarator) {
            //Get the variable name that calls createEventFactory function and will be use in the event functions
            const variableName = parent.id.type === AST_NODE_TYPES.Identifier && parent.id.name;
            if (!variableName) {
              return;
            }
            //Get the list of ExportNamedDeclaration nodes
            const variablesExported = context.sourceCode.ast.body.filter(
              (node) => node.type === AST_NODE_TYPES.ExportNamedDeclaration
            );
            //Filter the ExportNamedDeclaration nodes that contains the variable that calls createEventFactory function
            if (variablesExported && variablesExported.length > 0) {
              variablesExported.map((v) => {
                const exportedVar = v.declaration;
                if (exportedVar) {
                  const functionUsed =
                    exportedVar.type === AST_NODE_TYPES.VariableDeclaration &&
                    exportedVar.declarations[0].init?.type === AST_NODE_TYPES.BinaryExpression &&
                    exportedVar.declarations[0].init?.left.type === AST_NODE_TYPES.BinaryExpression &&
                    exportedVar.declarations[0].init?.left?.left.type === AST_NODE_TYPES.Identifier &&
                    exportedVar.declarations[0].init?.left?.left.name === variableName;
                  if (functionUsed) {
                    //If the exported variable calls the function that uses createEventFactory, check if it has comments
                    const comments = context.sourceCode.getCommentsBefore(v);
                    //If it doesn't have comments, report
                    if (!comments || comments.length === 0) {
                      return context.report({
                        node,
                        messageId: 'missingFunctionComment',
                      });
                    }
                    //If it has comments, check if it has @owner
                    if (comments && comments.length > 0) {
                      const hasOwner = comments.some((comment) =>  /@owner\b/.test(comment.value));
                      //If it doesn't have @owner, report
                      if (!hasOwner) {
                        return context.report({
                          node,
                          messageId: 'missingOwner',
                        });
                      }
                    }
                  }
                }
              });
            }
          }
        }
      },
      ImportSpecifier(node) {
        if (
          node.type === AST_NODE_TYPES.ImportSpecifier &&
          node.imported.type === AST_NODE_TYPES.Identifier &&
          node.imported.name === 'createEventFactory'
        ) {
          const importedAs = node.local.name;
          if (!importedAs) {
            return;
          }
          const variablesDeclared = context.sourceCode.ast.body.filter(
            (node) => node.type === AST_NODE_TYPES.VariableDeclaration
          );
          if (variablesDeclared.length > 0) {
            variablesDeclared.map((variable) => {
              const variableType = variable.declarations[0].type;
              const variableCallsFunction = variable.declarations[0]?.init?.type;
              if (
                variableType === AST_NODE_TYPES.VariableDeclarator &&
                variableCallsFunction === AST_NODE_TYPES.CallExpression
              ) {
                const variableName =
                  variable.declarations[0].init?.callee.type === AST_NODE_TYPES.Identifier &&
                  variable.declarations[0].init?.callee?.name;
                if (variableName && variableName === importedAs) {
                  const args = variable.declarations[0].init?.arguments;
                  const argsAreNotLiterals = args && args.some((arg) => arg.type !== AST_NODE_TYPES.Literal);

                  if (argsAreNotLiterals) {
                    return context.report({
                      node,
                      messageId: 'eventFactoryLiterals',
                    });
                  }
                  // const parent = variable.parent;
                  // if (parent) {
                  //   const comments =
                  //     parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
                  //     context.sourceCode.getCommentsBefore(parent);
                  //   if (comments && comments.length > 0) {
                  //     let hasOwner = true;
                  //     comments.map((comment) => {
                  //       if (!comment.value.includes('@owner')) {
                  //         hasOwner = false;
                  //       }
                  //     });
                  //     if (!hasOwner) {
                  //       return context.report({
                  //         node,
                  //         messageId: 'missingOwner',
                  //       });
                  //     }
                  //   } else {
                  //     return context.report({
                  //       node,
                  //       messageId: 'missingFunctionComment',
                  //     });
                  //   }
                  // }
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
      missingOwner: 'Missing @owner specification in the function description',
      missingFunctionComment: 'Event function needs to have a description of its purpose',
      bu: 'bu',
    },
    schema: [],
  },

  defaultOptions: [],
});

module.exports = trackingEventCreation;
