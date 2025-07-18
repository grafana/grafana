const noAriaLabelSelectors = require('./rules/no-aria-label-e2e-selectors.cjs');
const noBorderRadiusLiteral = require('./rules/no-border-radius-literal.cjs');
const noUnreducedMotion = require('./rules/no-unreduced-motion.cjs');
const themeTokenUsage = require('./rules/theme-token-usage.cjs');
const noRestrictedImgSrcs = require('./rules/no-restricted-img-srcs.cjs');
const consistentStoryTitles = require('./rules/consistent-story-titles.cjs');

module.exports = {
  rules: {
    'no-unreduced-motion': noUnreducedMotion,
    'no-aria-label-selectors': noAriaLabelSelectors,
    'no-border-radius-literal': noBorderRadiusLiteral,
    'theme-token-usage': themeTokenUsage,
    'no-restricted-img-srcs': noRestrictedImgSrcs,
    'consistent-story-titles': consistentStoryTitles,
  },
};
