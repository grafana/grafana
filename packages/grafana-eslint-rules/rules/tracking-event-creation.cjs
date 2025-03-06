// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const trackingEventCreation = createRule({
  create(context) {
    // Track what name createEventFactory is imported as
    let createEventFactoryName = 'createEventFactory';
    // Track variables that store createEventFactory calls
    const eventFactoryVariables = new Set();

    return {
      ImportSpecifier(node) {
        if (
          node.imported.type === AST_NODE_TYPES.Identifier &&
          node.imported.name === 'createEventFactory'
        ) {
          // Remember what name it was imported as (handles aliased imports)
          createEventFactoryName = node.local.name;
        }
      },
      VariableDeclarator(node) {
        // Track variables initialized with createEventFactory calls
        if (
          node.init?.type === AST_NODE_TYPES.CallExpression &&
          node.init.callee.type === AST_NODE_TYPES.Identifier &&
          node.init.callee.name === createEventFactoryName
        ) {
          const variableName = node.id.type === AST_NODE_TYPES.Identifier && node.id.name;
          if (variableName) {
            eventFactoryVariables.add(variableName);
          }

          // Check if arguments are literals
          const args = node.init.arguments;
          const argsAreNotLiterals = args.some((arg) => arg.type !== AST_NODE_TYPES.Literal);
          if (argsAreNotLiterals) {
            return context.report({
              node: node.init,
              messageId: 'eventFactoryLiterals',
            });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (
          node.declaration?.type === AST_NODE_TYPES.VariableDeclaration &&
          node.declaration.declarations[0].init?.type === AST_NODE_TYPES.CallExpression
        ) {
          const callee = node.declaration.declarations[0].init.callee;
          if (
            callee.type === AST_NODE_TYPES.Identifier &&
            eventFactoryVariables.has(callee.name)
          ) {
            // Check for comments
            const comments = context.sourceCode.getCommentsBefore(node);
            if (!comments || comments.length === 0) {
              return context.report({
                node,
                messageId: 'missingFunctionComment',
              });
            }
          }
        }
      }
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
      missingFunctionComment: 'Event function needs to have a description of its purpose',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = trackingEventCreation;
