// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXAttribute} JSXAttribute */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXElement} JSXElement */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXFragment} JSXFragment */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXText} JSXText */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXChild} JSXChild */
/** @typedef {import('@typescript-eslint/utils').TSESTree.Property} Property */
/** @typedef {import('@typescript-eslint/utils/ts-eslint').RuleFixer} RuleFixer */
/** @typedef {import('@typescript-eslint/utils/ts-eslint').RuleContext<'noUntranslatedStrings' | 'noUntranslatedStringsProp' | 'wrapWithTrans' | 'wrapWithT',  [{forceFix: string[]}]>} RuleContextWithOptions */
const { AST_NODE_TYPES } = require('@typescript-eslint/utils');

/**
 * @param {Node} node
 */
const elementIsTrans = (node) => {
  return (
    node.type === AST_NODE_TYPES.JSXElement &&
    node.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
    node.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
    node.openingElement.name.name === 'Trans'
  );
};

/**
 * @param {Node} node
 * @param {RuleContextWithOptions} context
 */
const getParentMethod = (node, context) => {
  const ancestors = context.sourceCode.getAncestors(node);
  return ancestors.find((anc) => {
    return (
      anc.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      anc.type === AST_NODE_TYPES.FunctionDeclaration ||
      anc.type === AST_NODE_TYPES.FunctionExpression ||
      anc.type === AST_NODE_TYPES.ClassDeclaration
    );
  });
};

/**
 * @param {Node} node
 */
const isStringLiteral = (node) => {
  return node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string';
};

/**
 * Converts a string to kebab case
 * @param {string} str The string to convert
 * @returns {string} The kebab case string
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Checks if a string is non-alphanumeric
 * @param {string} str The string to check
 * @returns {boolean}
 */
function isStringNonAlphanumeric(str) {
  return !/[a-zA-Z0-9]/.test(str);
}
/**
 * Checks if we _should_ fix an error automatically
 * @param {RuleContextWithOptions} context
 * @returns {boolean} Whether the node should be fixed
 */
function shouldBeFixed(context) {
  const pathsThatAreFixable = context.options[0]?.forceFix || [];
  return pathsThatAreFixable.some((path) => context.filename.includes(path));
}

/**
 * Checks if a node can be fixed automatically
 * @param {JSXAttribute|JSXElement|JSXFragment|Property} node The node to check
 * @param {RuleContextWithOptions} context
 * @returns {boolean} Whether the node can be fixed
 */
function canBeFixed(node, context) {
  if (!getTranslationPrefix(context)) {
    return false;
  }

  const parentMethod = getParentMethod(node, context);
  const isAttribute = node.type === AST_NODE_TYPES.JSXAttribute;
  const isProperty = node.type === AST_NODE_TYPES.Property;
  const isPropertyOrAttribute = isAttribute || isProperty;

  // We can only fix JSX attribute strings that are within a function,
  // otherwise the `t` function call will be made too early
  if (isPropertyOrAttribute && !parentMethod) {
    return false;
  }

  // If we're going to try and fix using `t`, and it already exists in the scope,
  // then we can't fix/provide a suggestion
  if (isPropertyOrAttribute && parentMethod) {
    const hasTDeclaration = getTDeclaration(parentMethod, context);
    if (hasTDeclaration) {
      return false;
    }
  }
  if (isAttribute && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return isStringLiteral(node.value.expression);
  }

  const values =
    node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment
      ? node.children.map((child) => {
          return getNodeValue(child);
        })
      : [getNodeValue(node)];

  const stringIsTooLong = values.some((value) => value.trim().split(' ').length > 10);
  // If we have more than 10 words,
  // we don't want to fix it automatically as the chance of a duplicate key is higher,
  // and it's better for a user to manually decide the key
  if (stringIsTooLong) {
    return false;
  }
  const stringIsNonAlphanumeric = values.some((value) => !/[a-zA-Z0-9]/.test(value));
  const stringContainsHTMLEntities = values.some((value) => /(&[a-zA-Z0-9]+;)/.test(value));
  // If node only contains non-alphanumeric characters,
  // or contains HTML character entities, then we don't want to autofix
  if (stringIsNonAlphanumeric || stringContainsHTMLEntities) {
    return false;
  }

  return true;
}

/**
 * For a given node, check the scope and find a variable declaration of `t`
 * @param {Node} node
 * @param {RuleContextWithOptions} context
 */
function getTDeclaration(node, context) {
  return context.sourceCode.getScope(node).variables.find((v) => v.name === 't');
}

/**
 * Gets the translation prefix from the filename
 * @param {RuleContextWithOptions} context
 * @returns {string|null} The translation prefix or null
 */
function getTranslationPrefix(context) {
  const filename = context.filename;
  const match = filename.match(/public\/app\/features\/(.+?)\//);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Gets the i18n key for a node
 * @param {JSXAttribute|JSXText|Property} node The node
 * @param {RuleContextWithOptions} context
 * @returns {string} The i18n key
 */
const getI18nKey = (node, context) => {
  const prefixFromFilePath = getTranslationPrefix(context);
  const stringValue = getNodeValue(node);

  const componentNames = getComponentNames(node, context);

  const propertyName =
    node.type === AST_NODE_TYPES.Property && node.key.type === AST_NODE_TYPES.Identifier ? String(node.key.name) : null;

  const words = stringValue
    .trim()
    .replace(/[^\a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/);

  const maxWordsForKey = 6;

  // If we have more than 6 words, filter out the words that are less than 4 characters
  // This heuristic tends to result in a good balance between unique and descriptive keys
  const filteredWords = words.length > maxWordsForKey ? words.filter((word) => word.length > 4) : words;

  // If we've filtered everything out, use the original words, deduplicated
  const wordsToUse = filteredWords.length === 0 ? words : filteredWords;
  const uniqueWords = [...new Set(wordsToUse)].slice(0, maxWordsForKey);

  let kebabString = toKebabCase(uniqueWords.join(' '));

  if (node.type === AST_NODE_TYPES.JSXAttribute) {
    const propName = node.name.name;
    const attribute = node.parent?.attributes.find(
      (attr) =>
        attr.type === AST_NODE_TYPES.JSXAttribute &&
        attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
        attr &&
        ['id', 'data-testid'].includes(attr.name?.name)
    );
    const potentialId =
      attribute &&
      attribute.type === AST_NODE_TYPES.JSXAttribute &&
      attribute.value &&
      attribute.value.type === AST_NODE_TYPES.Literal
        ? attribute.value.value
        : undefined;
    kebabString = [potentialId, propName, kebabString].filter(Boolean).join('-');
  }

  const fullPrefix = [prefixFromFilePath, ...componentNames, propertyName, kebabString].filter(Boolean).join('.');

  return fullPrefix;
};

/**
 * Gets component names from ancestors
 * @param {JSXAttribute|JSXText|Property} node The node
 * @param {RuleContextWithOptions} context
 * @returns {string[]} The component names
 */
function getComponentNames(node, context) {
  const names = [];
  const ancestors = context.sourceCode.getAncestors(node);

  for (const ancestor of ancestors) {
    if (
      ancestor.type === AST_NODE_TYPES.VariableDeclarator ||
      ancestor.type === AST_NODE_TYPES.FunctionDeclaration ||
      ancestor.type === AST_NODE_TYPES.ClassDeclaration
    ) {
      const name = ancestor.id?.type === AST_NODE_TYPES.Identifier ? ancestor.id.name : '';
      // Remove the word "component" from the name, as this is a bit
      // redundant in a translation key
      const sanitizedName = name.replace(/component/gi, '');
      names.push(toKebabCase(sanitizedName));
    }
  }

  return names;
}

/**
 * Gets the import fixer for a node
 * @param {JSXElement|JSXFragment|JSXAttribute|Property} node
 * @param {RuleFixer} fixer The fixer
 * @param {'Trans'|'t'} importName The member to import from `@grafana/i18n`
 * @param {RuleContextWithOptions} context
 * @returns {import('@typescript-eslint/utils/ts-eslint').RuleFix|undefined} The fix
 */
function getImportsFixer(node, fixer, importName, context) {
  const body = context.sourceCode.ast.body;

  /** Map of where we expect to import each translation util from */
  const importPackage = {
    Trans: '@grafana/i18n',
    t: '@grafana/i18n',
  };

  const expectedImport = importPackage[importName];

  const existingAppCoreI18n = body.find(
    (node) => node.type === AST_NODE_TYPES.ImportDeclaration && node.source.value === importPackage[importName]
  );

  // If there's no existing import at all, add it
  if (!existingAppCoreI18n) {
    return fixer.insertTextBefore(body[0], `import { ${importName} } from '${expectedImport}';\n`);
  }

  // To keep the typechecker happy - we have to explicitly check the type
  // so we can infer it further down
  if (existingAppCoreI18n.type !== AST_NODE_TYPES.ImportDeclaration) {
    return;
  }

  // If there's an existing import, and it already has the importName, do nothing
  if (
    existingAppCoreI18n.specifiers.some((s) => {
      return (
        s.type === AST_NODE_TYPES.ImportSpecifier &&
        s.imported.type === AST_NODE_TYPES.Identifier &&
        s.imported.name === importName
      );
    })
  ) {
    return;
  }
  const lastSpecifier = existingAppCoreI18n.specifiers[existingAppCoreI18n.specifiers.length - 1];
  /** @type {[number, number]} */
  const range = [lastSpecifier.range[1], lastSpecifier.range[1]];
  return fixer.insertTextAfterRange(range, `, ${importName}`);
}

/**
 * @param {JSXElement|JSXFragment} node
 * @param {RuleContextWithOptions} context
 * @returns {(fixer: RuleFixer) => import('@typescript-eslint/utils/ts-eslint').RuleFix[]}
 */
const getTransFixers = (node, context) => (fixer) => {
  const fixes = [];
  const children = node.children;
  children.forEach((child) => {
    if (child.type === AST_NODE_TYPES.JSXText) {
      const i18nKey = getI18nKey(child, context);
      const value = getNodeValue(child);
      fixes.push(fixer.replaceText(child, `<Trans i18nKey="${i18nKey}">${value}</Trans>`));
    }
  });

  const importsFixer = getImportsFixer(node, fixer, 'Trans', context);
  if (importsFixer) {
    fixes.push(importsFixer);
  }
  return fixes;
};

/**
 * @param {JSXAttribute|Property} node
 * @param {RuleContextWithOptions} context
 * @returns {(fixer: RuleFixer) => import('@typescript-eslint/utils/ts-eslint').RuleFix[]}
 */
const getTFixers = (node, context) => (fixer) => {
  const fixes = [];
  const i18nKey = getI18nKey(node, context);
  const value = getNodeValue(node);
  const wrappingQuotes = value.includes('"') ? "'" : '"';

  if (node.type === AST_NODE_TYPES.Property) {
    fixes.push(fixer.replaceText(node.value, `t("${i18nKey}", ${wrappingQuotes}${value}${wrappingQuotes})`));
  } else {
    fixes.push(
      fixer.replaceText(node, `${node.name.name}={t("${i18nKey}", ${wrappingQuotes}${value}${wrappingQuotes})}`)
    );
  }

  const importToAdd = 't';
  const importsFixer = getImportsFixer(node, fixer, importToAdd, context);
  if (importsFixer) {
    fixes.push(importsFixer);
  }

  return fixes;
};

/**
 * Gets the value of a node
 * @param {JSXAttribute|JSXText|JSXElement|JSXFragment|JSXChild|Property} node The node
 * @returns {string} The node value
 */
function getNodeValue(node) {
  if (
    (node.type === AST_NODE_TYPES.JSXAttribute || node.type === AST_NODE_TYPES.Property) &&
    node.value?.type === AST_NODE_TYPES.Literal
  ) {
    // TODO: Update this to return bool/number values and handle the type issues elsewhere
    // For now, we'll just return an empty string so we consider any numbers or booleans as not being issues
    if (typeof node.value.value === 'boolean' || typeof node.value.value === 'number') {
      return '';
    }
    return String(node.value.value) || '';
  }
  if (node.type === AST_NODE_TYPES.JSXText) {
    // Return the raw value if we can, so we can work out if there are any HTML entities
    return node.raw;
  }
  if (node.type === AST_NODE_TYPES.JSXAttribute && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
    // this condition is basically `isStringLiteral`, but we can't use the function
    // else it doesn't narrow the type correctly :(
    if (node.value.expression.type === AST_NODE_TYPES.Literal && typeof node.value.expression.value === 'string') {
      return node.value.expression.value;
    }
  }
  return '';
}

module.exports = {
  getNodeValue,
  getTFixers,
  getTransFixers,
  getTranslationPrefix,
  canBeFixed,
  shouldBeFixed,
  elementIsTrans,
  isStringNonAlphanumeric,
};
