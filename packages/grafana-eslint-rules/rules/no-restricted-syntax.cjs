const createNoRestrictedSyntax = require('eslint-no-restricted/syntax');

// This is a bit different - instead of defining a custom rule manually, we use
// eslint-no-restricted to turn no-restricted-syntax config into actual eslint rules.
// This gives them individual rule names for suppression and reporting.

/** @type {NonNullable<import('eslint').Linter.Plugin['rules']>} */
module.exports = createNoRestrictedSyntax(
  {
    name: 'no-plain-links',
    // value regex is to filter out whitespace-only text nodes (e.g. new lines and spaces in the JSX)
    selector: "JSXElement[openingElement.name.name='a'] > JSXText[value!=/^\\s*$/]",
    message: 'No bare anchor nodes containing only text. Use `TextLink` instead.',
  },
  {
    name: 'no-direct-local-storage-access',
    selector: 'Identifier[name=localStorage], MemberExpression[object.name=localStorage]',
    message: 'Direct usage of localStorage is not allowed. import store from @grafana/data instead',
  },
  {
    name: 'require-no-margin',
    selector: [
      'Program:has(ImportDeclaration[source.value="@grafana/ui"] ImportSpecifier[imported.name="Field"]) JSXOpeningElement[name.name="Field"]:not(:has(JSXAttribute[name.name="noMargin"]))',
      'Program:has(ImportDeclaration[source.value="@grafana/ui"] ImportSpecifier[imported.name="Card"]) JSXOpeningElement[name.name="Card"]:not(:has(JSXAttribute[name.name="noMargin"]))',
    ].join(', '),
    message:
      'Add noMargin prop this component to remove built-in margins. Use layout components like Stack or Grid with the gap prop instead for consistent spacing.',
  },
  {
    name: 'no-locale-compare',
    selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="localeCompare"]',
    message:
      'Using localeCompare() can cause performance issues when sorting large datasets. Consider using Intl.Collator for better performance when sorting arrays, or add an eslint-disable comment if sorting a small, known dataset.',
  },
  {
    name: 'no-gf-form',
    selector: 'Literal[value=/gf-form/], TemplateElement[value.cooked=/gf-form/]',
    message: 'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.',
  },
  {
    name: 'no-config-apps',
    selector: 'MemberExpression[object.name="config"][property.name="apps"]',
    message:
      'Usage of config.apps is not allowed. Use the function getAppPluginMetas or useAppPluginMetas from @grafana/runtime/internal instead',
  },
  {
    name: 'no-config-panels',
    selector: 'MemberExpression[object.name="config"][property.name="panels"]',
    message:
      'Usage of config.panels is not allowed. Use the function getPanelPluginMetas or usePanelPluginMetas from @grafana/runtime/internal instead',
  },
  {
    name: 'no-direct-date-fns',
    selector: 'ImportDeclaration[source.value="date-fns"][importKind!="type"]',
    message: 'Use deep imports instead (e.g. date-fns/format) to avoid pulling in the entire library.',
  }
);
