const noAriaLabelSelectors = require('./rules/no-aria-label-e2e-selectors.cjs');
const themeImports = require('./rules/theme-imports.cjs');

module.exports = {
  rules: {
    'no-aria-label-selectors': noAriaLabelSelectors,
    'theme-imports': themeImports,
  },
};
