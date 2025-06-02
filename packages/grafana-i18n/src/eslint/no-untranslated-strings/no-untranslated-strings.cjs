// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXElement} JSXElement */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXFragment} JSXFragment */
/** @typedef {import('@typescript-eslint/utils').TSESLint.RuleModule<'noUntranslatedStrings' | 'noUntranslatedStringsProp' | 'wrapWithTrans' | 'wrapWithT' | 'noUntranslatedStringsProperties', [{ forceFix: string[] , calleesToIgnore: string[] }]>} RuleDefinition */
/** @typedef {import('@typescript-eslint/utils/ts-eslint').RuleContext<'noUntranslatedStrings' | 'noUntranslatedStringsProp' | 'wrapWithTrans' | 'wrapWithT' | 'noUntranslatedStringsProperties',  [{forceFix: string[], calleesToIgnore: string[]}]>} RuleContextWithOptions */

const {
  getNodeValue,
  getTFixers,
  getTransFixers,
  canBeFixed,
  elementIsTrans,
  shouldBeFixed,
  stringShouldBeTranslated,
  nodeHasTransAncestor,
  templateLiteralShouldBeTranslated,
} = require('./translation-utils.cjs');

const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-i18n/src/eslint/README.md#${name}`
);

/**
 * JSX props to check for untranslated strings
 */
const propsToCheck = ['content', 'label', 'description', 'placeholder', 'aria-label', 'title', 'text', 'tooltip'];

/**
 * Object properties to check for untranslated strings
 */
const propertiesToCheck = [
  'label',
  'description',
  'placeholder',
  'aria-label',
  'ariaLabel',
  'title',
  'subTitle',
  'text',
  'tooltip',
  'message',
];

/** @type {RuleDefinition} */
const noUntranslatedStrings = createRule({
  /**
   * @param {RuleContextWithOptions} context
   */
  create(context) {
    const calleesToIgnore = context.options[0]?.calleesToIgnore || [];
    const propertiesRegexes = calleesToIgnore.map((pattern) => {
      return new RegExp(pattern);
    });

    return {
      Property(node) {
        const { key, value, parent, computed } = node;
        const keyName = (() => {
          if (computed) {
            return null;
          }
          if (key.type === AST_NODE_TYPES.Identifier && typeof key.name === 'string') {
            return key.name;
          }
          return null;
        })();

        // Catch cases of default props setting object properties, which would be at the top level
        const isAssignmentPattern = parent.parent.type === AST_NODE_TYPES.AssignmentPattern;

        if (
          !keyName ||
          !propertiesToCheck.includes(keyName) ||
          parent.type === AST_NODE_TYPES.ObjectPattern ||
          isAssignmentPattern
        ) {
          return;
        }

        const callExpression = parent.parent.type === AST_NODE_TYPES.CallExpression ? parent.parent.callee : null;
        // Check if we're being called by something that we want to ignore
        // e.g. css({ label: 'test' }) should be ignored (based on the rule configuration)
        if (
          callExpression?.type === AST_NODE_TYPES.Identifier &&
          propertiesRegexes.some((regex) => regex.test(callExpression.name))
        ) {
          return;
        }

        const nodeValue = getNodeValue(node);
        const isUntranslated = stringShouldBeTranslated(nodeValue);

        const errorCanBeFixed = canBeFixed(node, context);
        const errorShouldBeFixed = shouldBeFixed(context);
        if (
          isUntranslated &&
          // TODO: Remove this check in the future when we've fixed all cases of untranslated properties
          // For now, we're only reporting the issues that can be auto-fixed, rather than adding to betterer results
          errorCanBeFixed
        ) {
          context.report({
            node,
            messageId: 'noUntranslatedStringsProperties',
            fix: errorCanBeFixed && errorShouldBeFixed ? getTFixers(node, context) : undefined,
            suggest: [
              {
                messageId: 'wrapWithT',
                fix: getTFixers(node, context),
              },
            ],
          });
        }
      },

      JSXAttribute(node) {
        if (
          !node.value ||
          // We handle JSXExpressionContainer separately
          node.value.type === AST_NODE_TYPES.JSXExpressionContainer ||
          !propsToCheck.includes(String(node.name.name))
        ) {
          return;
        }

        const nodeValue = getNodeValue(node);
        const isUntranslated = stringShouldBeTranslated(nodeValue);

        if (isUntranslated) {
          const errorShouldBeFixed = shouldBeFixed(context);
          const errorCanBeFixed = canBeFixed(node, context);
          return context.report({
            node,
            messageId: 'noUntranslatedStringsProp',
            fix: errorShouldBeFixed && errorCanBeFixed ? getTFixers(node, context) : undefined,
            suggest: errorCanBeFixed
              ? [
                  {
                    messageId: 'wrapWithT',
                    fix: getTFixers(node, context),
                  },
                ]
              : undefined,
          });
        }
      },
      JSXExpressionContainer(node) {
        const { parent, expression } = node;
        const { type: parentType } = parent;

        const isInAttribute = parentType === AST_NODE_TYPES.JSXAttribute;
        const isInElement = parentType === AST_NODE_TYPES.JSXElement;
        const isUnsupportedAttribute = isInAttribute && !propsToCheck.includes(String(parent.name.name));
        const isConditional = expression.type === AST_NODE_TYPES.ConditionalExpression;
        const isLogical = expression.type === AST_NODE_TYPES.LogicalExpression;
        const isTemplateLiteral = expression.type === AST_NODE_TYPES.TemplateLiteral;
        const isStringLiteral = expression.type === AST_NODE_TYPES.Literal && typeof expression.value === 'string';

        const isUnsupported = isUnsupportedAttribute || (!isInAttribute && !isInElement);
        const isNotConditionOrLiteral = !isConditional && !isLogical && !isTemplateLiteral && !isStringLiteral;

        if (isUnsupported || isNotConditionOrLiteral) {
          return;
        }

        const hasTransAncestor = nodeHasTransAncestor(node, context);

        const messageId =
          parentType === AST_NODE_TYPES.JSXAttribute ? 'noUntranslatedStringsProp' : 'noUntranslatedStrings';

        /**
         * @param {Node} expr
         */
        const isExpressionUntranslated = (expr) => {
          const nodeValue = getNodeValue(expr);
          return (
            (expr.type === AST_NODE_TYPES.Literal &&
              typeof expr.value === 'string' &&
              stringShouldBeTranslated(nodeValue)) ||
            (expr.type === AST_NODE_TYPES.TemplateLiteral && templateLiteralShouldBeTranslated(expr))
          );
        };

        const untranslatedExpressions = [
          isConditional && expression.consequent,
          isConditional && expression.alternate,
          isLogical && expression.left,
          isLogical && expression.right,
        ]
          .filter((node) => !!node)
          .filter((node) => node.type === AST_NODE_TYPES.Literal || node.type === AST_NODE_TYPES.TemplateLiteral)
          .filter((node) => {
            const templateLiterals =
              node.type === AST_NODE_TYPES.TemplateLiteral && templateLiteralShouldBeTranslated(node);
            const shouldBe = isExpressionUntranslated(node) || templateLiterals;
            return shouldBe;
          });

        if (untranslatedExpressions.length && !hasTransAncestor) {
          untranslatedExpressions.forEach((untranslatedNode) => {
            const errorCanBeFixed = canBeFixed(untranslatedNode, context);
            const errorShouldBeFixed = shouldBeFixed(context);
            context.report({
              node: untranslatedNode,
              messageId,
              fix: errorCanBeFixed && errorShouldBeFixed ? getTFixers(untranslatedNode, context) : undefined,
              suggest: errorCanBeFixed
                ? [
                    {
                      messageId: 'wrapWithT',
                      fix: getTFixers(untranslatedNode, context),
                    },
                  ]
                : undefined,
            });
          });
        }

        const nodeValue = getNodeValue(node);
        const shouldBeTranslated = stringShouldBeTranslated(nodeValue);
        if (isTemplateLiteral) {
          const anyTemplateLiteralsShouldBeTranslated = templateLiteralShouldBeTranslated(expression);
          if (!anyTemplateLiteralsShouldBeTranslated) {
            return;
          }
        }
        if (!isTemplateLiteral && (!nodeValue || !shouldBeTranslated)) {
          return;
        }
        if (isTemplateLiteral || (shouldBeTranslated && !hasTransAncestor)) {
          const errorCanBeFixed = canBeFixed(node, context);
          context.report({
            node,
            messageId: 'noUntranslatedStrings',
            suggest: errorCanBeFixed
              ? [
                  {
                    messageId: 'wrapWithT',
                    fix: getTFixers(node.expression, context),
                  },
                ]
              : undefined,
          });
        }
      },

      /**
       * @param {JSXElement|JSXFragment} node
       */
      'JSXElement, JSXFragment'(node) {
        const parent = node.parent;
        const children = node.children;
        const untranslatedTextNodes = children.filter((child) => {
          if (child.type === AST_NODE_TYPES.JSXText) {
            const nodeValue = getNodeValue(child);
            const shouldBeTranslated = stringShouldBeTranslated(nodeValue);
            if (!nodeValue || !shouldBeTranslated) {
              return false;
            }
            const ancestors = context.sourceCode.getAncestors(node);
            const hasTransAncestor =
              elementIsTrans(node) ||
              ancestors.some((ancestor) => {
                return elementIsTrans(ancestor);
              });
            return !hasTransAncestor;
          }
          return false;
        });

        const parentHasChildren =
          parent.type === AST_NODE_TYPES.JSXElement || parent.type === AST_NODE_TYPES.JSXFragment;

        // We don't want to report if the parent has a text node,
        // as we'd end up doing it twice. This makes it awkward for us to auto fix
        const parentHasText = parentHasChildren
          ? parent.children.some((child) => {
              const childValue = getNodeValue(child);
              return child.type === AST_NODE_TYPES.JSXText && stringShouldBeTranslated(childValue);
            })
          : false;

        if (untranslatedTextNodes.length && !parentHasText) {
          const errorShouldBeFixed = shouldBeFixed(context);
          const errorCanBeFixed = canBeFixed(node, context);
          context.report({
            node,
            messageId: 'noUntranslatedStrings',
            fix: errorShouldBeFixed && errorCanBeFixed ? getTransFixers(node, context) : undefined,
            suggest: errorCanBeFixed
              ? [
                  {
                    messageId: 'wrapWithTrans',
                    fix: getTransFixers(node, context),
                  },
                ]
              : undefined,
          });
        }
      },
    };
  },
  name: 'no-untranslated-strings',
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    fixable: 'code',
    docs: {
      description: 'Check untranslated strings',
    },
    messages: {
      noUntranslatedStrings: 'No untranslated strings. Wrap text with <Trans /> or use t()',
      noUntranslatedStringsProp: `No untranslated strings in text props. Wrap text with <Trans /> or use t()`,
      noUntranslatedStringsProperties: `No untranslated strings in object properties. Wrap text with t()`,
      wrapWithTrans: 'Wrap text with <Trans /> for manual key assignment',
      wrapWithT: 'Wrap text with t() for manual key assignment',
    },
    schema: [
      {
        type: 'object',
        properties: {
          forceFix: {
            type: 'array',
            items: {
              type: 'string',
            },
            uniqueItems: true,
          },
          calleesToIgnore: {
            type: 'array',
            items: {
              type: 'string',
            },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ forceFix: [], calleesToIgnore: [] }],
});

module.exports = noUntranslatedStrings;
