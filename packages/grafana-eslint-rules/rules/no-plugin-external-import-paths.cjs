// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.ImportDeclaration} ImportDeclaration */
const { ESLintUtils } = require('@typescript-eslint/utils');
const path = require('path');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

/**
 * Extract the plugin root directory from the file path
 * @param {string} filePath - The file path being linted
 * @returns {string|null} - The plugin root directory or null if not in a plugin directory
 */
function getPluginRootDirectory(filePath) {
  const pluginMatch = filePath.match(/\/plugins\/(?:panel|datasource)\/([^/]+)\//);
  if (pluginMatch) {
    const pluginName = pluginMatch[1];
    const pluginType = pluginMatch[0].includes('/panel/') ? 'panel' : 'datasource';

    const pluginDirPath = `/plugins/${pluginType}/${pluginName}`;
    const pluginDirStart = filePath.indexOf(pluginDirPath);
    if (pluginDirStart !== -1) {
      const pluginRoot = filePath.substring(0, pluginDirStart + pluginDirPath.length);
      return path.isAbsolute(pluginRoot) ? pluginRoot : path.resolve(pluginRoot);
    }
  }
  return null;
}

/**
 * Check if an import path reaches outside the plugin's root directory boundaries
 * @param {string} importPath - The import path to check
 * @param {string} currentFilePath - The current file path being linted
 * @param {string} pluginRoot - The plugin root directory
 * @returns {boolean} - True if the import goes outside plugin boundaries
 */
function isImportOutsidePluginBoundaries(importPath, currentFilePath, pluginRoot) {
  const isRelativeImport = importPath.startsWith('./') || importPath.startsWith('../');
  if (!isRelativeImport) {
    return false;
  }

  const currentDir = path.dirname(currentFilePath);
  const resolvedPath = path.resolve(currentDir, importPath);

  const normalizedResolvedPath = path.normalize(resolvedPath);
  const normalizedPluginRoot = path.normalize(pluginRoot);

  return !normalizedResolvedPath.startsWith(normalizedPluginRoot);
}

const noRestrictedPeerPluginPathsRule = createRule({
  create(context) {
    const currentFilePath = context.getFilename();
    const pluginRoot = getPluginRootDirectory(currentFilePath);

    if (!pluginRoot) {
      return {};
    }

    return {
      /** @param {ImportDeclaration} node */
      ImportDeclaration(node) {
        const importPath = node.source.value;

        if (
          typeof importPath === 'string' &&
          isImportOutsidePluginBoundaries(importPath, currentFilePath, pluginRoot)
        ) {
          return context.report({
            node: node.source,
            messageId: 'importOutsidePluginBoundaries',
            data: {
              importPath,
              pluginRoot: path.basename(pluginRoot),
            },
          });
        }
      },
    };
  },
  name: 'no-plugin-external-import-paths',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports that reach outside plugin root directory boundaries',
    },
    messages: {
      importOutsidePluginBoundaries:
        "Import '{{importPath}}' reaches outside the '{{pluginRoot}}' plugin directory. Plugins should only import from external dependencies or relative paths within their own directory.",
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = noRestrictedPeerPluginPathsRule;
