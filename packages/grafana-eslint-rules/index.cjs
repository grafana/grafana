const noAriaLabelSelectors = require('./rules/no-aria-label-e2e-selectors.cjs');
const noBorderRadiusLiteral = require('./rules/no-border-radius-literal.cjs');

module.exports = {
  rules: {
    'no-aria-label-selectors': noAriaLabelSelectors,
    'no-border-radius-literal': noBorderRadiusLiteral,
  },
};
