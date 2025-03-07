// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const trackingEventCreation = createRule({
  create(context) {
    // Track what name createEventFactory is imported as
    let createEventFactoryName = 'createEventFactory';
    // Track if createEventFactory is imported
    let isCreateEventFactoryImported = false;
    // Track variables that store createEventFactory calls
    const eventFactoryVariables = new Set();

    return {
      ImportSpecifier(node) {
        if (node.imported.type === AST_NODE_TYPES.Identifier && node.imported.name === 'createEventFactory') {
          // Remember what name it was imported as (handles aliased imports)
          createEventFactoryName = node.local.name;
          isCreateEventFactoryImported = true;
        }
      },
      VariableDeclarator(node) {
        if (!isCreateEventFactoryImported) {
          return;
        }
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
        if (!isCreateEventFactoryImported) {
          return;
        }
        if (
          node.declaration?.type === AST_NODE_TYPES.VariableDeclaration &&
          node.declaration.declarations[0].init?.type === AST_NODE_TYPES.CallExpression
        ) {
          const callee = node.declaration.declarations[0].init.callee;
          if (callee.type === AST_NODE_TYPES.Identifier && eventFactoryVariables.has(callee.name)) {
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
      },
      TSInterfaceDeclaration(node) {
        if (!isCreateEventFactoryImported) {
          return;
        }
        // Check if interface extends TrackingEvent
        let extendsTrackingEvent = false;
        if (node.extends && node.extends.length > 0) {
          const interfaceExtends = node.extends;
          extendsTrackingEvent = interfaceExtends.some((extend) => {
            return extend.expression.type === AST_NODE_TYPES.Identifier && extend.expression.name === 'TrackingEventProps';
          });
        }
        if (!node.extends || !extendsTrackingEvent) {
          return context.report({
            node,
            messageId: 'interfaceMustExtend',
          });
        }
        //Check if the interface properties has comments
        if(node.body.type === AST_NODE_TYPES.TSInterfaceBody){
          const properties = node.body.body;
          properties.forEach(property => {
            const comments = context.sourceCode.getCommentsBefore(property);
            if (!comments || comments.length === 0) {
              return context.report({
                node: property,
                messageId: 'missingPropertyComment',
              });
            }
          });
        }
      },
      TSTypeAliasDeclaration(node) {
        if (!isCreateEventFactoryImported) {
          return;
        }
        // Check if types has comments
        const comments = context.sourceCode.getCommentsBefore(node);
        if (!comments || comments.length === 0) {
          return context.report({
            node,
            messageId: 'missingPropertyComment',
          });
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
      missingPropertyComment: 'Event property needs to have a description of its purpose',
      interfaceMustExtend: 'Interface must extend `TrackingEvent`',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = trackingEventCreation;
