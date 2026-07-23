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

    // Names of variables assigned from defineFeatureEvents(...)
    const factoryVariables = new Set();

    // Resolves whether a node is a call to a tracked factory variable.
    // Recurses into CallExpression callees to handle factory<P>('event')(props).
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

    // Also handles arrow-wrapper variant: (props: X) => factory<X>('event')({ ...props })
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

      // Handles two export patterns:
      //   a) Grouped object:  export const Events = { event: factory<P>('name'), ... }
      //   b) Individual:      export const event = factory<P>('name')
      ExportNamedDeclaration(node) {
        if (!isDefineFeatureEventsImported) {
          return;
        }

        const decl = node.declaration;
        if (decl?.type !== AST_NODE_TYPES.VariableDeclaration) {
          return;
        }

        const init = decl.declarations[0]?.init;
        if (!init) {
          return;
        }

        // Pattern (a) — grouped object
        if (init.type === AST_NODE_TYPES.ObjectExpression) {
          const isEventsObject = init.properties.some(
            (prop) => prop.type === AST_NODE_TYPES.Property && propertyValueCallsFactory(prop.value)
          );
          if (!isEventsObject) {
            return;
          }

          for (const prop of init.properties) {
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
          return;
        }

        // Pattern (b) — individual export
        if (callsFactoryVariable(init)) {
          if (context.sourceCode.getCommentsBefore(node).length === 0) {
            context.report({ node: decl.declarations[0].id, messageId: 'missingEventComment' });
          }
        }
      },

      // Enforces extends + JSDoc on each property for EventProperty interfaces
      TSInterfaceDeclaration(node) {
        if (!isEventPropertyImported) {
          return;
        }

        const extendsEventProperty =
          node.extends?.some(
            (e) => e.expression.type === AST_NODE_TYPES.Identifier && e.expression.name === 'EventProperty'
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
      missingEventComment: 'Each event must have a JSDoc comment describing when it fires or its purpose.',
      interfaceMustExtend: 'Event property interfaces must extend `EventProperty` from `@grafana/runtime/internal`.',
      missingPropertyComment: 'Each interface property must have a JSDoc comment describing what it captures.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = defineFeatureEventsRule;
