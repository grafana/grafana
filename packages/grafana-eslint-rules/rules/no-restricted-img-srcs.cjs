// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Literal} Literal */
/** @typedef {import('@typescript-eslint/utils').TSESTree.TemplateLiteral} TemplateLiteral */
const { getImageImportFixers, replaceWithPublicBuild } = require('./import-utils.cjs');

const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const PUBLIC_IMG_DIR = 'public/img/';

const imgSrcRule = createRule({
  create(context) {
    return {
      /**
       * @param {Literal|TemplateLiteral} node
       */
      'Literal, TemplateLiteral'(node) {
        if (node.type === AST_NODE_TYPES.TemplateLiteral) {
          if (node.quasis.some((quasi) => quasi.value.raw.includes(PUBLIC_IMG_DIR))) {
            return context.report({
              node,
              messageId: 'publicImg',
            });
          }
          return;
        }

        const { value } = node;

        if (value && typeof value === 'string' && value.includes(PUBLIC_IMG_DIR)) {
          return context.report({
            node,
            messageId: 'publicImg',
            suggest: [
              {
                messageId: 'importImage',
                fix: (fixer) => getImageImportFixers(fixer, node, context),
              },
              {
                messageId: 'useBuildFolder',
                fix: (fixer) => replaceWithPublicBuild(fixer, node),
              },
            ],
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
