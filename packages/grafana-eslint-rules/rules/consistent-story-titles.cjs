// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

/**
 * @param {string} title
 * @returns {boolean}
 */
const isValidStorybookTitle = (title) => {
  if (typeof title !== 'string') {
    return true; // Skip non-string titles
  }

  const sections = title.split('/');

  // Allow up to 3 sections if one of them is 'Deprecated'
  if (sections.some((section) => section.trim() === 'Deprecated')) {
    return sections.length <= 3;
  }

  // Otherwise, limit to maximum 2 sections (1 slash)
  return sections.length <= 2;
};

/**
 * @param {import('@typescript-eslint/utils').TSESTree.ObjectExpression} objectNode
 * @param {import('@typescript-eslint/utils/ts-eslint').RuleContext<'invalidTitle', []>} context
 */
const checkObjectForTitle = (objectNode, context) => {
  const titleProperty = objectNode.properties.find(
    (prop) =>
      prop.type === AST_NODE_TYPES.Property && prop.key.type === AST_NODE_TYPES.Identifier && prop.key.name === 'title'
  );

  if (
    titleProperty &&
    titleProperty.type === AST_NODE_TYPES.Property &&
    titleProperty.value.type === AST_NODE_TYPES.Literal
  ) {
    const titleValue = titleProperty.value.value;

    if (typeof titleValue === 'string' && !isValidStorybookTitle(titleValue)) {
      context.report({
        node: titleProperty.value,
        messageId: 'invalidTitle',
        data: {
          title: titleValue,
        },
      });
    }
  }
};

const consistentStoryTitlesRule = createRule({
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        // Only check .story.tsx files
        const filename = context.filename;
        if (!filename || !filename.endsWith('.story.tsx')) {
          return;
        }

        if (node.declaration.type === AST_NODE_TYPES.ObjectExpression) {
          // Handle direct object export: export default { title: '...' }
          checkObjectForTitle(node.declaration, context);
        } else if (node.declaration.type === AST_NODE_TYPES.Identifier) {
          // Handle variable reference export: export default storyConfig
          const variableName = node.declaration.name;
          const scope = context.sourceCode.getScope(node);
          const variable = scope.set.get(variableName);

          if (variable) {
            // Find the variable declaration
            const declaration = variable.defs.find((def) => def.type === 'Variable');
            if (
              declaration &&
              declaration.node.init &&
              declaration.node.init.type === AST_NODE_TYPES.ObjectExpression
            ) {
              checkObjectForTitle(declaration.node.init, context);
            }
          }
        }
      },
    };
  },
  name: 'consistent-story-titles',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce consistent Storybook titles with maximum two sections (1 slash) unless one is "Deprecated"',
    },
    messages: {
      invalidTitle:
        'Storybook title "{{ title }}" has too many sections. Use maximum 2 sections (1 slash) unless one section is "Deprecated".',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = consistentStoryTitlesRule;
