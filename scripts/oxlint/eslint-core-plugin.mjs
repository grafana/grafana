// Exposes the ESLint core rules oxlint doesn't implement natively, so they can run as a JS plugin.
import { builtinRules } from 'eslint/use-at-your-own-risk';

const ruleNames = ['dot-notation', 'eol-last', 'new-parens', 'no-restricted-syntax', 'sort-imports'];

export default {
  meta: { name: 'eslint-js' },
  rules: Object.fromEntries(ruleNames.map((name) => [name, builtinRules.get(name)])),
};
