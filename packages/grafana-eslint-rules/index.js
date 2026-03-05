import consistentStoryTitles from './rules/consistent-story-titles.js';
import noAriaLabelSelectors from './rules/no-aria-label-e2e-selectors.js';
import noBorderRadiusLiteral from './rules/no-border-radius-literal.js';
import noInvalidCssProperties from './rules/no-invalid-css-properties.js';
import noPluginExternalImportPaths from './rules/no-plugin-external-import-paths.js';
import noRestrictedImgSrcs from './rules/no-restricted-img-srcs.js';
import noUnreducedMotion from './rules/no-unreduced-motion.js';
import themeTokenUsage from './rules/theme-token-usage.js';

export default {
  rules: {
    'no-unreduced-motion': noUnreducedMotion,
    'no-aria-label-selectors': noAriaLabelSelectors,
    'no-border-radius-literal': noBorderRadiusLiteral,
    'theme-token-usage': themeTokenUsage,
    'no-restricted-img-srcs': noRestrictedImgSrcs,
    'consistent-story-titles': consistentStoryTitles,
    'no-plugin-external-import-paths': noPluginExternalImportPaths,
    'no-invalid-css-properties': noInvalidCssProperties,
  },
};
