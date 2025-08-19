// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Literal} Literal */
/** @typedef {import('@typescript-eslint/utils').TSESTree.TemplateLiteral} TemplateLiteral */
const { getImageImportFixers, replaceWithPublicBuild, isInvalidImageLocation } = require('./import-utils.cjs');

const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const imgSrcRule = createRule({
  create(context) {
    return {
      /**
       * @param {Literal|TemplateLiteral} node
       */
      'Literal, TemplateLiteral'(node) {
        if (node.type === AST_NODE_TYPES.TemplateLiteral) {
          if (node.quasis.some((quasi) => isInvalidImageLocation(quasi.value.raw))) {
            return context.report({
              node,
              messageId: 'publicImg',
            });
          }
          return;
        }

        const { value } = node;

        if (value && typeof value === 'string' && isInvalidImageLocation(value)) {
          const canUseBuildFolder = value.startsWith('public/img/');
          /**
           * @type {import('@typescript-eslint/utils/ts-eslint').SuggestionReportDescriptor<"publicImg" | "importImage" | "useBuildFolder">[]}
           */
          const suggestions = [
            {
              messageId: 'importImage',
              fix: (fixer) => getImageImportFixers(fixer, node, context),
            },
          ];

          if (canUseBuildFolder) {
            suggestions.push({
              messageId: 'useBuildFolder',
              fix: (fixer) => replaceWithPublicBuild(fixer, node),
            });
          }

          return context.report({
            node,
            messageId: 'publicImg',
            suggest: suggestions,
          });
        }
      },
    };
  },
  name: 'no-restricted-img-srcs',
  meta: {
    fixable: 'code',
    hasSuggestions: true,
    type: 'problem',
    docs: {
      description: 'Disallow references to images in the public folder',
    },
    messages: {
      publicImg:
        "Don't reference image sources from the public folder. Either use the build folder or import the image",
      importImage: 'Import image instead',
      useBuildFolder: 'Use public/build path instead',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = imgSrcRule;
