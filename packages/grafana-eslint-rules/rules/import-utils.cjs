// @ts-check
const { AST_NODE_TYPES } = require('@typescript-eslint/utils');
const { upperFirst } = require('lodash');

/** @typedef {import('@typescript-eslint/utils/ts-eslint').RuleContext<'publicImg' | 'importImage' | 'useBuildFolder',  []>} RuleContextWithOptions */

/**
 * @param {string} str
 */
const camelCase = (str) => {
  return str
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word, index) => (index === 0 ? word : upperFirst(word)))
    .join('');
};

/**
 * @param {string} value
 * @returns {string}
 */
const convertPathToImportName = (value) => {
  const fullFileName = value.split('/').pop() || '';
  const fileType = fullFileName.split('.').pop();
  const fileName = fullFileName.replace(`.${fileType}`, '');
  return camelCase(fileName) + upperFirst(fileType);
};

/**
 * @param {import('@typescript-eslint/utils/ts-eslint').RuleFixer} fixer
 * @param {import('@typescript-eslint/utils').TSESTree.StringLiteral} node
 * @param {RuleContextWithOptions} context
 */
function getImageImportFixers(fixer, node, context) {
  const { value: importPath } = node;
  const pathWithoutPublic = importPath.replace('public/', '');

  /** e.g. public/img/checkbox.png -> checkboxPng */
  const imageImportName = convertPathToImportName(importPath);

  const body = context.sourceCode.ast.body;

  const existingImport = body.find(
    (node) => node.type === AST_NODE_TYPES.ImportDeclaration && node.source.value === pathWithoutPublic
  );

  const fixers = [];

  // If there's no existing import at all, add a fixer for this
  if (!existingImport) {
    const importStatementFixer = fixer.insertTextBefore(
      body[0],
      `import ${imageImportName} from '${pathWithoutPublic}';\n`
    );
    fixers.push(importStatementFixer);
  }

  const isInAttribute = node.parent.type === AST_NODE_TYPES.JSXAttribute;
  const variableReplacement = isInAttribute ? `{${imageImportName}}` : imageImportName;
  const variableFixer = fixer.replaceText(node, variableReplacement);
  fixers.push(variableFixer);

  return fixers;
}

/**
 * @param {import('@typescript-eslint/utils/ts-eslint').RuleFixer} fixer
 * @param {import('@typescript-eslint/utils').TSESTree.StringLiteral} node
 */
const replaceWithPublicBuild = (fixer, node) => {
  const { value } = node;

  const startingQuote = node.raw.startsWith('"') ? '"' : "'";
  return fixer.replaceText(
    node,
    `${startingQuote}${value.replace('public/img/', 'public/build/img/')}${startingQuote}`
  );
};

/**
 * @param {string} value
 */
const isInvalidImageLocation = (value) => {
  return (
    value.startsWith('public/img/') ||
    (!value.startsWith('public/build/') &&
      !value.startsWith('public/plugins/') &&
      /public.*(\.svg|\.png|\.jpg|\.jpeg|\.gif)$/.test(value))
  );
};

module.exports = {
  getImageImportFixers,
  replaceWithPublicBuild,
  isInvalidImageLocation,
};
