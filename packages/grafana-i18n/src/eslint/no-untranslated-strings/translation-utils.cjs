// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXAttribute} JSXAttribute */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXElement} JSXElement */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXFragment} JSXFragment */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXText} JSXText */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXChild} JSXChild */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXExpressionContainer} JSXExpressionContainer */
/** @typedef {import('@typescript-eslint/utils').TSESTree.Literal} Literal */
/** @typedef {import('@typescript-eslint/utils').TSESTree.TemplateLiteral} TemplateLiteral */
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
const nodeHasTransAncestor = (node, context) => {
  const ancestors = context.sourceCode.getAncestors(node);
  return ancestors.some((anc) => elementIsTrans(anc));
};

/**
 * @param {Node} node
 * @param {RuleContextWithOptions} context
 */
const getParentMethods = (node, context) => {
  const ancestors = context.sourceCode.getAncestors(node);
  return ancestors.filter((anc) => {
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
 * @param {RuleContextWithOptions} context
 */
const getParentJsxAttribute = (node, context) => {
  if (node.type === AST_NODE_TYPES.JSXAttribute) {
    return node;
  }
  const ancestors = context.sourceCode.getAncestors(node);
  return ancestors.find((anc) => {
    return anc.type === AST_NODE_TYPES.JSXAttribute;
  });
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
 * Checks if a string is alphanumeric (because we likely don't want to translate numbers or symbols)
 * @param {string} str The string to check
 * @returns {boolean}
 */
function stringIsAlphanumeric(str) {
  return /[a-zA-Z0-9]/.test(str);
}

/**
 * Checks if a string should be translated
 * @param {string} string
 */
const stringShouldBeTranslated = (string) => {
  const specialCases = ['null', 'nan'];
  if (specialCases.includes(string.toLowerCase())) {
    return false;
  }
  return string.trim() && stringIsAlphanumeric(string);
};

/**
 * @param {TemplateLiteral} node
 * @returns {boolean}
 */
const templateLiteralShouldBeTranslated = (node) => {
  const { quasis } = node;
  return quasis.some((quasi) => {
    return stringShouldBeTranslated(getNodeValue(quasi));
  });
};

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
 * @param {Node} node The node to check
 * @param {RuleContextWithOptions} context
 * @returns {boolean} Whether the node can be fixed
 */
function canBeFixed(node, context) {
  if (!getTranslationPrefix(context)) {
    return false;
  }

  const parentMethods = getParentMethods(node, context);
  const isAttribute = node.type === AST_NODE_TYPES.JSXAttribute;
  const isProperty = node.type === AST_NODE_TYPES.Property;
  const isTemplateLiteral =
    node.type === AST_NODE_TYPES.TemplateLiteral ||
    (node.type === AST_NODE_TYPES.JSXExpressionContainer && node.expression.type === AST_NODE_TYPES.TemplateLiteral);
  const isPropertyOrAttribute = isAttribute || isProperty;

  // We can only fix JSX attribute strings that are within a function,
  // otherwise the `t` function call will be made too early
  // We also can't easily fix template literals
  if ((isPropertyOrAttribute && !parentMethods.length) || isTemplateLiteral) {
    return false;
  }

  // If we're going to try and fix using `t`, and it already exists in the scope,
  // but not from `useTranslate`, then we can't fix/provide a suggestion
  if (isPropertyOrAttribute && parentMethods) {
    // todo fix recursively find t
    const hasTDeclaration = getTVariable(parentMethods[0], context);
    const hasUseTranslateDeclaration = methodHasUseTranslate(parentMethods[0], context);
    if (hasTDeclaration && !hasUseTranslateDeclaration) {
      return false;
    }
  }

  const isJsxElementOrFragment = node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment;

  if (isJsxElementOrFragment) {
    const hasJsxSibling = node.children.some(
      (child) => child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXExpressionContainer
    );
    if (hasJsxSibling) {
      return false;
    }
  }

  const values = isJsxElementOrFragment
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
  const stringIsNonAlphanumeric = values.some((value) => value.trim() && !stringIsAlphanumeric(value));
  const stringContainsHTMLEntities = values.some((value) => /(&[a-zA-Z0-9]+;)/.test(value));
  // If node only contains non-alphanumeric characters,
  // or contains HTML character entities, then we don't want to autofix
  if (stringIsNonAlphanumeric || stringContainsHTMLEntities) {
    return false;
  }

  return true;
}

/**
 * Gets the translation prefix from the filename
 * @param {RuleContextWithOptions} context
 * @returns {string|null} The translation prefix or null
 */
function getTranslationPrefix(context) {
  const filename = context.filename;
  const match = filename.match(/public\/app\/(?:features)\/(.+?)\//);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Gets the i18n key for a node
 * @param {Node} node The node
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

  // Recursively find the parent JSX attribute, as we might be dealing with a literal or
  // expression inside an attribute
  const parentJsxAttribute = getParentJsxAttribute(node, context);

  if (parentJsxAttribute) {
    const propName = toKebabCase(String(parentJsxAttribute.name.name));
    const attribute = parentJsxAttribute.parent?.attributes
      .filter((attr) => attr.type === AST_NODE_TYPES.JSXAttribute)
      .find(
        (attr) =>
          attr.name.type === AST_NODE_TYPES.JSXIdentifier && attr && ['id', 'data-testid'].includes(attr.name?.name)
      );
    const potentialId =
      attribute && attribute.value && attribute.value.type === AST_NODE_TYPES.Literal
        ? attribute.value.value
        : undefined;
    kebabString = [potentialId, propName, kebabString].filter(Boolean).join('-');
  }

  const fullPrefix = [prefixFromFilePath, ...componentNames, propertyName, kebabString].filter(Boolean).join('.');

  return fullPrefix;
};

/**
 * Gets component names from ancestors
 * @param {Node} node The node
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
      if (!name) {
        continue;
      }
      // Remove the word "component" from the name, as this is a bit
      // redundant in a translation key
      const sanitizedName = name.replace(/component/gi, '');
      names.push(toKebabCase(sanitizedName));
    }
  }

  return names;
}

/**
 * For a given node, check the scope and find a variable declaration of `t`
 * @param {Node} node
 * @param {RuleContextWithOptions} context
 */
function getTVariable(node, context) {
  return context.sourceCode.getScope(node).variables.find((v) => v.name === 't');
}

/**
 * Checks if a node has a variable declaration of `t`
 * that came from a `useTranslate` call
 * @param {Node} node The node
 * @param {RuleContextWithOptions} context
 */
function methodHasUseTranslate(node, context) {
  const tVariable = getTVariable(node, context);
  if (!tVariable) {
    return false;
  }

  const { defs } = tVariable;

  return defs
    .filter((def) => def.node.type === AST_NODE_TYPES.VariableDeclarator)
    .find((definition) => {
      const isVariableDeclaration = definition.node.type === AST_NODE_TYPES.VariableDeclarator;
      const declarationInit = isVariableDeclaration ? definition.node.init : null;
      return (
        isVariableDeclaration &&
        declarationInit &&
        declarationInit.type === AST_NODE_TYPES.CallExpression &&
        declarationInit.callee.type === AST_NODE_TYPES.Identifier &&
        declarationInit.callee.name === 'useTranslate'
      );
    });
}

/**
 * Gets the import fixer for a node
 * @param {Node} node
 * @param {RuleFixer} fixer The fixer
 * @param {'Trans'|'t'|'useTranslate'} importName The member to import from either `@grafana/i18n` or `@grafana/i18n/internal`
 * @param {RuleContextWithOptions} context
 * @returns {import('@typescript-eslint/utils/ts-eslint').RuleFix|undefined} The fix
 */
function getImportsFixer(node, fixer, importName, context) {
  const body = context.sourceCode.ast.body;

  /** Map of where we expect to import each translation util from */
  const importPackage = {
    Trans: '@grafana/i18n',
    useTranslate: '@grafana/i18n',
    t: '@grafana/i18n/internal',
  };

  const parentMethod = getParentMethods(node, context);

  if (importName === 't') {
    // If we're trying to import `t`,
    // and there's already a `t` variable declaration in the parent method that came from `useTranslate`,
    // do nothing
    const declarationFromUseTranslate = parentMethod ? methodHasUseTranslate(parentMethod[0], context) : false;
    if (declarationFromUseTranslate) {
      return;
    }
  }

  const expectedImport = importPackage[importName];

  const existingAppCoreI18n = body
    .filter((node) => node.type === AST_NODE_TYPES.ImportDeclaration)
    .find((node) => node.source.value === importPackage[importName]);

  // If there's no existing import at all, add it
  if (!existingAppCoreI18n) {
    return fixer.insertTextBefore(body[0], `import { ${importName} } from '${expectedImport}';\n`);
  }

  const existingSpecifier = existingAppCoreI18n.specifiers.some((s) => {
    return (
      s.type === AST_NODE_TYPES.ImportSpecifier &&
      s.imported.type === AST_NODE_TYPES.Identifier &&
      s.imported.name === importName
    );
  });

  // If there's an existing import, and it already has the importName, do nothing
  if (existingSpecifier) {
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
 * @param {string} str
 */
const firstCharIsUpper = (str) => {
  return str.charAt(0) === str.charAt(0).toUpperCase();
};

/**
 * @param {Node} node
 * @param {RuleFixer} fixer
 * @param {RuleContextWithOptions} context
 * @returns {import('@typescript-eslint/utils/ts-eslint').RuleFix|undefined} The fix
 */
const getUseTranslateFixer = (node, fixer, context) => {
  const [parentMethod] = getParentMethods(node, context);
  if (!parentMethod || parentMethod.body.type !== AST_NODE_TYPES.BlockStatement) {
    return;
  }
  const parentMethodName = (() => {
    if (parentMethod.type === AST_NODE_TYPES.FunctionDeclaration && parentMethod.id) {
      return parentMethod.id.name;
    }
    if (
      parentMethod.parent.type === AST_NODE_TYPES.VariableDeclarator &&
      parentMethod.parent.id.type === AST_NODE_TYPES.Identifier
    ) {
      return parentMethod.parent.id.name;
    }
    return null;
  })();

  const nameIsNotUpperCase = parentMethodName && !firstCharIsUpper(parentMethodName);
  const nameStartsWithUse = parentMethodName && parentMethodName.startsWith('use');

  // If the node is not within a function, or the parent method does not start with an uppercase letter,
  // and does not start with `use` (i.e. it's not a React hook),
  // then we can't reliably add `useTranslate`, as this may not be a React component
  if (nameIsNotUpperCase && !nameStartsWithUse) {
    return;
  }

  const returnStatement = parentMethod.body.body.find((node) => node.type === AST_NODE_TYPES.ReturnStatement);
  if (!returnStatement) {
    return;
  }

  const returnStatementIsJsx =
    returnStatement.argument &&
    (returnStatement.argument.type === AST_NODE_TYPES.JSXElement ||
      returnStatement.argument.type === AST_NODE_TYPES.JSXFragment);

  if (!returnStatementIsJsx && !nameStartsWithUse) {
    return;
  }
  const tDeclarationExists = getTVariable(parentMethod, context);
  const useTranslateExists = methodHasUseTranslate(parentMethod, context);

  if (tDeclarationExists && useTranslateExists) {
    return;
  }

  // If we've got all this way, then:
  // - There is a parent method
  // - It returns JSX
  // - The method name starts with a capital letter
  // - There is not already a call to `useTranslate` in the parent method
  // In that scenario, we assume that we can fix and add a usage of the hook to the start of the body of the method
  return fixer.insertTextBefore(parentMethod.body.body[0], 'const { t } = useTranslate();\n');
};

/**
 * @param {Node} node
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
  }
  if (node.type === AST_NODE_TYPES.Literal) {
    fixes.push(fixer.replaceText(node, `t("${i18nKey}", ${wrappingQuotes}${value}${wrappingQuotes})`));
  }
  if (node.type === AST_NODE_TYPES.JSXAttribute) {
    fixes.push(
      fixer.replaceText(node, `${node.name.name}={t("${i18nKey}", ${wrappingQuotes}${value}${wrappingQuotes})}`)
    );
  }

  // Check if we need to add `useTranslate` to the node
  const useTranslateFixer = getUseTranslateFixer(node, fixer, context);
  if (useTranslateFixer) {
    fixes.push(useTranslateFixer);
  }

  // Check if we need to add `t` or `useTranslate` to the imports
  const importToAdd = useTranslateFixer ? 'useTranslate' : 't';
  const importsFixer = getImportsFixer(node, fixer, importToAdd, context);
  if (importsFixer) {
    fixes.push(importsFixer);
  }

  return fixes;
};

/**
 * Gets the value of a node
 * @param {Node} node The node
 * @returns {string} The node value
 */
function getNodeValue(node) {
  if (node.type === AST_NODE_TYPES.Literal) {
    return String(node.value);
  }

  if (node.type === AST_NODE_TYPES.TemplateElement) {
    return node.value.raw;
  }

  if (node.type === AST_NODE_TYPES.JSXText) {
    // Return the raw value if we can, so we can work out if there are any HTML entities
    return node.raw;
  }

  if (node.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return getNodeValue(node.expression);
  }

  const isAttributeOrProperty = node.type === AST_NODE_TYPES.JSXAttribute || node.type === AST_NODE_TYPES.Property;

  if (isAttributeOrProperty && node.value?.type === AST_NODE_TYPES.Literal) {
    // TODO: Update this to return bool/number values and handle the type issues elsewhere
    // For now, we'll just return an empty string so we consider any numbers or booleans as not being issues
    if (typeof node.value.value === 'boolean' || typeof node.value.value === 'number') {
      return '';
    }
    return String(node.value.value) || '';
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
  stringShouldBeTranslated,
  nodeHasTransAncestor,
  templateLiteralShouldBeTranslated,
};
