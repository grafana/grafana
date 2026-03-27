// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const defineFeatureEventsRule = createRule({
  create(context) {
    let defineFeatureEventsName = 'defineFeatureEvents';
    let isDefineFeatureEventsImported = false;
    let isEventPropertyImported = false;

    // Variable names assigned from defineFeatureEvents(...) calls.
    // e.g. const newDashboardLibraryInteraction = defineFeatureEvents(...)
    const factoryVariables = new Set();

    // Recursively checks whether a CallExpression's callee resolves to a
    // tracked factory variable. Handles the double-call pattern produced by
    // defineFeatureEvents: factory<P>('event') returns a function, which is
    // then immediately called with props — making callee itself a CallExpression.
    /** @param {import('@typescript-eslint/utils').TSESTree.Node} node */
    function callsFactoryVariable(node) {
      if (node.type !== AST_NODE_TYPES.CallExpression) {
        return false;
      }
      const callee = node.callee;
      if (callee.type === AST_NODE_TYPES.Identifier && factoryVariables.has(callee.name)) {
        return true;
      }
      if (callee.type === AST_NODE_TYPES.CallExpression) {
        return callsFactoryVariable(callee);
      }
      return false;
    }

    // Handles both direct factory calls and the arrow-wrapper variant pattern:
    // (props: X) => factory<X>('event')({ ...props, featureVariant: Y })
    /** @param {import('@typescript-eslint/utils').TSESTree.Node} valueNode */
    function propertyValueCallsFactory(valueNode) {
      if (callsFactoryVariable(valueNode)) {
        return true;
      }
      if (
        valueNode.type === AST_NODE_TYPES.ArrowFunctionExpression &&
        valueNode.body.type === AST_NODE_TYPES.CallExpression
      ) {
        return callsFactoryVariable(valueNode.body);
      }
      return false;
    }

    return {
      // 1. Detect imports
      ImportSpecifier(node) {
        if (node.imported.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        if (node.imported.name === 'defineFeatureEvents') {
          defineFeatureEventsName = node.local.name;
          isDefineFeatureEventsImported = true;
        }
        if (node.imported.name === 'EventProperty') {
          isEventPropertyImported = true;
        }
      },

      // 2. Track factory variables + enforce literal args
      VariableDeclarator(node) {
        if (!isDefineFeatureEventsImported) {
          return;
        }
        if (
          node.init?.type === AST_NODE_TYPES.CallExpression &&
          node.init.callee.type === AST_NODE_TYPES.Identifier &&
          node.init.callee.name === defineFeatureEventsName
        ) {
          const varName = node.id.type === AST_NODE_TYPES.Identifier && node.id.name;
          if (varName) {
            factoryVariables.add(varName);
          }

          const [repoArg, featureArg] = node.init.arguments;
          if (repoArg && repoArg.type !== AST_NODE_TYPES.Literal) {
            context.report({ node: repoArg, messageId: 'literalArgsRequired' });
          }
          if (featureArg && featureArg.type !== AST_NODE_TYPES.Literal) {
            context.report({ node: featureArg, messageId: 'literalArgsRequired' });
          }
        }
      },

      // 3. Exported events object: require @owner JSDoc + per-event comments
      ExportNamedDeclaration(node) {
        if (!isDefineFeatureEventsImported) {
          return;
        }

        const decl = node.declaration;
        if (
          decl?.type !== AST_NODE_TYPES.VariableDeclaration ||
          decl.declarations[0]?.init?.type !== AST_NODE_TYPES.ObjectExpression
        ) {
          return;
        }

        const objExpr = decl.declarations[0].init;
        const isEventsObject = objExpr.properties.some(
          (prop) => prop.type === AST_NODE_TYPES.Property && propertyValueCallsFactory(prop.value)
        );
        if (!isEventsObject) {
          return;
        }

        const comments = context.sourceCode.getCommentsBefore(node);
        const hasOwner = comments.some((c) => c.type === 'Block' && c.value.includes('@owner'));
        if (!hasOwner) {
          context.report({ node: decl.declarations[0].id, messageId: 'missingOwnerTag' });
        }

        for (const prop of objExpr.properties) {
          if (prop.type !== AST_NODE_TYPES.Property) {
            continue;
          }
          if (!propertyValueCallsFactory(prop.value)) {
            continue;
          }

          if (context.sourceCode.getCommentsBefore(prop).length === 0) {
            context.report({ node: prop, messageId: 'missingEventComment' });
          }
        }
      },

      // 4. Interfaces in EventProperty files: enforce extends + JSDoc on each property
      TSInterfaceDeclaration(node) {
        if (!isEventPropertyImported) {
          return;
        }

        const extendsEventProperty =
          node.extends?.some(
            (e) =>
              e.expression.type === AST_NODE_TYPES.Identifier &&
              e.expression.name === 'EventProperty'
          ) ?? false;

        if (!extendsEventProperty) {
          context.report({ node, messageId: 'interfaceMustExtend' });
          return;
        }

        for (const member of node.body.body) {
          if (context.sourceCode.getCommentsBefore(member).length === 0) {
            context.report({ node: member, messageId: 'missingPropertyComment' });
          }
        }
      },
    };
  },

  name: 'define-feature-events',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce documentation and best practices for defineFeatureEvents usage',
    },
    messages: {
      literalArgsRequired:
        'The `repo` and `feature` arguments to `defineFeatureEvents` must be string literals, not variables.',
      missingOwnerTag: 'Exported events object must have a JSDoc block comment with an `@owner` tag.',
      missingEventComment: 'Each event in the object must have a JSDoc comment describing when it fires.',
      interfaceMustExtend:
        'Event property interfaces must extend `EventProperty` from `@grafana/runtime/internal`.',
      missingPropertyComment: 'Each interface property must have a JSDoc comment describing what it captures.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = defineFeatureEventsRule;
