// @ts-check
/** @typedef {import('@typescript-eslint/utils').TSESTree.Node} Node */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXAttribute} JSXAttribute */
/** @typedef {import('@typescript-eslint/utils').TSESTree.JSXText} JSXText */
/** @typedef {import('@typescript-eslint/utils/ts-eslint').RuleFixer} RuleFixer */

const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

/** @type {string[]} */
const propsToCheck = ['label', 'description', 'placeholder', 'aria-label', 'title', 'text', 'tooltip'];

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

const noUntranslatedStrings = createRule({
  create(context) {
    /**
     * Gets the translation prefix from the filename
     * @returns {string|null} The translation prefix or null
     */
    function getTranslationPrefix() {
      const filename = context.getFilename();
      const match = filename.match(/public\/app\/features\/([^/]+)/);
      if (match) {
        return match[1];
      }
      return null;
    }

    /**
     * Checks if a node can be fixed automatically
     * @param {JSXAttribute|JSXText} node The node to check
     * @returns {boolean} Whether the node can be fixed
     */
    function canBeFixed(node) {
      if (!getTranslationPrefix()) {
        return false;
      }

      // We can only fix strings that are within a function,
      // otherwise the `t` function call will be made too early
      const ancestors = context.sourceCode.getAncestors(node);
      const isInFunction = ancestors.some((anc) => {
        return [
          AST_NODE_TYPES.ArrowFunctionExpression,
          AST_NODE_TYPES.FunctionDeclaration,
          AST_NODE_TYPES.ClassDeclaration,
        ].includes(anc.type);
      });

      if (!isInFunction) {
        return false;
      }

      if (node.type === AST_NODE_TYPES.JSXAttribute && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
        return false;
      }

      const value = getNodeValue(node);
      const stringIsTooLong = value.trim().split(' ').length > 10;
      // If we have more than 10 words,
      // we don't want to fix it automatically as the chance of a duplicate key is higher,
      // and it's better for a user to manually decide the key
      if (stringIsTooLong) {
        return false;
      }
      const stringIsNonAlphanumeric = value && !/[a-zA-Z0-9]/.test(value);
      const stringContainsHTMLEntities = /(&[a-zA-Z0-9]+;)/.test(value);
      // If node only contains non-alphanumeric characters,
      // or contains HTML character entities, then we don't want to autofix
      if (stringIsNonAlphanumeric || stringContainsHTMLEntities) {
        return false;
      }

      // If we've got to this point for a JSX attribute,
      // then we can assume we can autofix
      if (node.type === AST_NODE_TYPES.JSXAttribute) {
        return true;
      }

      // Check if node has JSX expression siblings
      const parent = node.parent;

      // If we have a sibling that is an expression or element, then we don't want to autofix
      // E.g.:
      // <div>Foo {someVar}</div>
      const hasJSXExpressionOrElementSibling =
        parent.type === AST_NODE_TYPES.JSXElement &&
        parent.children.some(
          (child) => child.type === AST_NODE_TYPES.JSXExpressionContainer || child.type === AST_NODE_TYPES.JSXElement
        );
      if (hasJSXExpressionOrElementSibling) {
        return false;
      }

      const siblings =
        parent.type === AST_NODE_TYPES.JSXElement && parent.parent.type === AST_NODE_TYPES.JSXElement
          ? parent.parent.children
          : [];

      const hasJSXTextSibling = siblings.some((child) => {
        return child.type === AST_NODE_TYPES.JSXText && getNodeValue(child).trim();
      });

      const hasHtmlTagSibling = siblings.some((child) => {
        return (
          child.type === AST_NODE_TYPES.JSXElement &&
          child.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
          ['code', 'pre'].includes(child.openingElement.name.name)
        );
      });

      if (hasHtmlTagSibling || hasJSXTextSibling) {
        return false;
      }

      return true;
    }

    /**
     * Gets the import fixer for a node
     * @param {JSXAttribute|JSXText} node The node
     * @param {RuleFixer} fixer The fixer
     * @param {string} importName The import name
     * @returns {import('@typescript-eslint/utils/ts-eslint').RuleFix|undefined} The fix
     */
    function getImportsFixer(node, fixer, importName) {
      const body = context.sourceCode.ast.body;

      const existingAppCoreI18n = body.find(
        (node) =>
          node.type === AST_NODE_TYPES.ImportDeclaration && node.source.value === 'app/core/internationalization'
      );

      // If there's no existing import at all, add it
      if (!existingAppCoreI18n) {
        return fixer.insertTextBefore(body[0], `import { ${importName} } from 'app/core/internationalization';\n`);
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
     * Gets the i18n key for a node
     * @param {JSXAttribute|JSXText} node The node
     * @returns {string} The i18n key
     */
    const getI18nKey = (node) => {
      const prefixFromFilePath = getTranslationPrefix();
      const stringValue = getNodeValue(node);

      const componentNames = getComponentNames(node);
      const words = stringValue
        .trim()
        .replace(/[^\a-zA-Z\s]/g, '')
        .trim()
        .split(/\s+/);

      // If we have more than 6 words, filter out the words that are less than 4 characters
      // This heuristic tends to result in a good balance between unique and descriptive keys
      const filteredWords = words.length > 6 ? words.filter((word) => word.length > 4) : words;

      // If we've filtered everything out, use the original words, deduplicated
      const wordsToUse = filteredWords.length === 0 ? words : filteredWords;
      const uniqueWords = [...new Set(wordsToUse)].slice(0, 6);

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

      const fullPrefix = [prefixFromFilePath, ...componentNames, kebabString].filter(Boolean).join('.');

      return fullPrefix;
    };

    /**
     * Gets component names from ancestors
     * @param {JSXAttribute|JSXText} node The node
     * @returns {string[]} The component names
     */
    function getComponentNames(node) {
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
     * Gets the value of a node
     * @param {JSXAttribute|JSXText} node The node
     * @returns {string} The node value
     */
    function getNodeValue(node) {
      if (node.type === AST_NODE_TYPES.JSXAttribute && node.value?.type === AST_NODE_TYPES.Literal) {
        return String(node.value.value) || '';
      }
      if (node.type === AST_NODE_TYPES.JSXText) {
        // Return the raw value if we can, so we can work out if there are any HTML entities
        return node.raw;
      }
      return '';
    }

    /**
     * @param {JSXAttribute|JSXText} node
     * @returns {(fixer: RuleFixer) => import('@typescript-eslint/utils/ts-eslint').RuleFix[]}
     */
    const getTransFixers = (node) => (fixer) => {
      const fixes = [];
      const i18nKey = getI18nKey(node);
      const value = getNodeValue(node);
      fixes.push(fixer.replaceText(node, `<Trans i18nKey="${i18nKey}">${value}</Trans>`));

      const importsFixer = getImportsFixer(node, fixer, 'Trans');
      if (importsFixer) {
        fixes.push(importsFixer);
      }
      return fixes;
    };

    /**
     * @param {JSXAttribute} node
     * @returns {(fixer: RuleFixer) => import('@typescript-eslint/utils/ts-eslint').RuleFix[]}
     */
    const getTFixers = (node) => (fixer) => {
      const fixes = [];
      const i18nKey = getI18nKey(node);
      const value = getNodeValue(node);
      const wrappingQuotes = value.includes('"') ? "'" : '"';

      fixes.push(
        fixer.replaceText(node, `${node.name.name}={t("${i18nKey}", ${wrappingQuotes}${value}${wrappingQuotes})}`)
      );

      const importsFixer = getImportsFixer(node, fixer, 't');
      if (importsFixer) {
        fixes.push(importsFixer);
      }
      return fixes;
    };

    return {
      JSXAttribute(node) {
        if (!propsToCheck.includes(String(node.name.name)) || !node.value) {
          return;
        }

        const isUntranslatedProp =
          (node.value.type === 'Literal' && node.value.value !== '') ||
          (node.value.type === 'JSXExpressionContainer' &&
            (node.value.expression.type === 'Literal' || node.value.expression.type === 'TemplateLiteral'));

        if (isUntranslatedProp) {
          return context.report({
            node,
            messageId: 'noUntranslatedStringsProp',
            fix: canBeFixed(node) ? getTFixers(node) : undefined,
          });
        }
      },
      JSXText(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const isEmpty = !node.value.trim();
        const hasTransAncestor = ancestors.some((ancestor) => {
          return (
            ancestor.type === AST_NODE_TYPES.JSXElement &&
            ancestor.openingElement.type === AST_NODE_TYPES.JSXOpeningElement &&
            ancestor.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier &&
            ancestor.openingElement.name.name === 'Trans'
          );
        });
        if (!isEmpty && !hasTransAncestor) {
          context.report({
            node,
            messageId: 'noUntranslatedStrings',
            fix: canBeFixed(node) ? getTransFixers(node) : undefined,
          });
        }
      },
    };
  },
  name: 'no-untranslated-strings',
  meta: {
    type: 'suggestion',
    // hasSuggestions: true,
    fixable: 'code',
    docs: {
      description: 'Check untranslated strings',
    },
    messages: {
      noUntranslatedStrings: 'No untranslated strings. Wrap text with <Trans />',
      noUntranslatedStringsProp: `No untranslated strings in text props. Wrap text with <Trans /> or use t()`,
      wrapWithTrans: `Wrap with <Trans /> with suggested key`,
      wrapWithT: `Wrap with t() method with suggested key`,
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = noUntranslatedStrings;
