// @ts-check
const { getImageImportFixers, replaceWithPublicBuild } = require('./import-utils.cjs');

const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const imgSrcRule = createRule({
  create(context) {
    return {
      Literal: function (node) {
        const { value } = node;

        if (
          node.parent.type !== AST_NODE_TYPES.ImportDeclaration &&
          value &&
          typeof value === 'string' &&
          value.includes('public/img/')
        ) {
          context.report({
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
