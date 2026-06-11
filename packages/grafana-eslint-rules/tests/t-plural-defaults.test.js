import { RuleTester } from 'eslint';

import rule from '../rules/t-plural-defaults.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

const ruleTester = new RuleTester();

const nonEmptyPositionalDefault = { messageId: 'nonEmptyPositionalDefault' };
const missingDefaultValueOne = { messageId: 'missingDefaultValueOne' };
const missingDefaultValueOther = { messageId: 'missingDefaultValueOther' };

ruleTester.run('t-plural-defaults', rule, {
  valid: [
    // No options object at all
    { code: `t('foo', 'Hello')` },

    // Options object without count — rule does not apply
    { code: `t('foo', 'Hello {{name}}', { name })` },
    { code: `t('foo', 'Hello {{name}}', { name, defaultValue_one: 'x' })` },

    // The required shape: empty positional + both plural forms in options
    {
      code: `t('foo', '', { count, defaultValue_one: '{{count}} item', defaultValue_other: '{{count}} items' })`,
    },

    // Order of properties in the options object should not matter
    {
      code: `t('foo', '', { defaultValue_one: '{{count}} item', count, defaultValue_other: '{{count}} items' })`,
    },

    // Spread in options — can't statically prove count/defaults are or aren't there, so skip
    {
      code: `t('foo', 'Hello {{count}} things', { count, ...others })`,
    },

    // Not a t() call
    {
      code: `translate('foo', 'Hello {{count}} things', { count, defaultValue_one: 'x' })`,
    },

    // Member-expression callee (e.g. i18n.t) — out of scope
    {
      code: `i18n.t('foo', 'Hello {{count}} things', { count })`,
    },
  ],

  invalid: [
    // Pre-PR shape: positional present + defaultValue_other missing.
    {
      code: `t('foo', 'Last {{count}} minutes', { count, defaultValue_one: 'Last {{count}} minute' })`,
      errors: [nonEmptyPositionalDefault, missingDefaultValueOther],
    },

    // Positional present + both plural forms already in options. Only the positional default is wrong.
    {
      code: `t('foo', 'Last {{count}} minutes', { count, defaultValue_one: 'Last {{count}} minute', defaultValue_other: 'Last {{count}} minutes' })`,
      errors: [nonEmptyPositionalDefault],
    },

    // Double-quoted positional default — still reported, both forms missing matters too.
    {
      code: `t("foo", "Last {{count}} minutes", { count, defaultValue_one: "Last {{count}} minute" })`,
      errors: [nonEmptyPositionalDefault, missingDefaultValueOther],
    },

    // count present but neither plural form provided. Two missing errors (no positional error because it's empty).
    {
      code: `t('foo', '', { count })`,
      errors: [missingDefaultValueOne, missingDefaultValueOther],
    },

    // count present, only defaultValue_other present.
    {
      code: `t('foo', '', { count, defaultValue_other: '{{count}} items' })`,
      errors: [missingDefaultValueOne],
    },

    // count present, only defaultValue_one present, empty positional.
    {
      code: `t('foo', '', { count, defaultValue_one: '{{count}} item' })`,
      errors: [missingDefaultValueOther],
    },

    // Non-literal positional default (identifier) + missing defaultValue_one. Two errors.
    {
      code: `t('foo', fallback, { count, defaultValue_other: '{{count}} items' })`,
      errors: [nonEmptyPositionalDefault, missingDefaultValueOne],
    },

    // Template literal positional default with an expression. All three problems.
    {
      code: "t('foo', `Last ${count} minutes`, { count })",
      errors: [nonEmptyPositionalDefault, missingDefaultValueOne, missingDefaultValueOther],
    },

    // Template literal positional default without an expression. All three problems.
    {
      code: "t('foo', 'Hello {{count}}', { count })",
      errors: [nonEmptyPositionalDefault, missingDefaultValueOne, missingDefaultValueOther],
    },

    // Non-string positional value — should still report nonEmptyPositionalDefault.
    {
      code: `t('foo', 42, { count, defaultValue_one: 'x', defaultValue_other: 'y' })`,
      errors: [nonEmptyPositionalDefault],
    },
  ],
});
