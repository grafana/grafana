// @ts-check
const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

// Grafana style creators are named `getStyles` / `getXxxStyles` by convention.
const STYLES_FN_RE = /Styles$/;

const preferUseStyles2 = createRule({
  create(context) {
    // Names bound to `useTheme2()` in this file (usually `theme`). A style creator
    // receiving one of these directly bypasses useStyles2's memoization.
    /** @type {Set<string>} */
    const themeVars = new Set();

    /** @param {import('@typescript-eslint/utils').TSESTree.CallExpressionArgument} arg */
    function argUsesTheme(arg) {
      if (arg.type === AST_NODE_TYPES.Identifier) {
        return themeVars.has(arg.name);
      }
      // e.g. getStyles({ theme, size })
      if (arg.type === AST_NODE_TYPES.ObjectExpression) {
        return arg.properties.some(
          (p) =>
            p.type === AST_NODE_TYPES.Property &&
            p.value.type === AST_NODE_TYPES.Identifier &&
            themeVars.has(p.value.name)
        );
      }
      return false;
    }

    return {
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === AST_NODE_TYPES.CallExpression &&
          node.init.callee.type === AST_NODE_TYPES.Identifier &&
          node.init.callee.name === 'useTheme2' &&
          node.id.type === AST_NODE_TYPES.Identifier
        ) {
          themeVars.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.Identifier ||
          !STYLES_FN_RE.test(node.callee.name) ||
          !node.arguments.some(argUsesTheme)
        ) {
          return;
        }

        // Only the per-render className pattern: `const styles = getStyles(theme)` or `cx(getStyles(theme))`.
        // Style creators whose result flows straight into `<Global styles={[...]}>` are one-time global
        // stylesheets, not per-instance render styles, and useStyles2 does not apply to them.
        const parent = node.parent;
        const isAssigned = parent && parent.type === AST_NODE_TYPES.VariableDeclarator && parent.init === node;
        const inCx =
          parent &&
          parent.type === AST_NODE_TYPES.CallExpression &&
          parent.callee.type === AST_NODE_TYPES.Identifier &&
          parent.callee.name === 'cx';
        if (!isAssigned && !inCx) {
          return;
        }

        context.report({
          node,
          messageId: 'preferUseStyles2',
          data: { name: node.callee.name },
        });
      },
    };
  },
  name: 'prefer-use-styles2',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer useStyles2 over calling a style creator directly with a useTheme2() theme, so styles are memoized instead of re-serialized on every render.',
    },
    messages: {
      preferUseStyles2:
        'Call {{ name }} through useStyles2 (e.g. useStyles2({{ name }}, ...args)) so its styles are memoized instead of re-serialized on every render.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = preferUseStyles2;
