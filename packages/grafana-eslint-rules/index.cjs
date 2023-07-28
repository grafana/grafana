const noAriaLabelSelectors = require('./rules/no-aria-label-e2e-selectors.cjs');
const themeTokenUsage = require('./rules/theme-token-usage.cjs');

module.exports = {
  rules: {
    'no-aria-label-selectors': noAriaLabelSelectors,
    'theme-token-usage': themeTokenUsage,
  },
};
