import { RuleTester } from 'eslint';

import rule from './trans-plural-defaults.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

const ruleTester = new RuleTester();

const missingTOptions = { messageId: 'missingTOptions' };
const missingDefaultValueOne = { messageId: 'missingDefaultValueOne' };
const missingDefaultValueOther = { messageId: 'missingDefaultValueOther' };

ruleTester.run('trans-plural-defaults', rule, {
  valid: [
    // No count anywhere — rule does not apply
    { code: `<Trans i18nKey="foo">Hello</Trans>` },
    { code: `<Trans i18nKey="foo" values={{ name: 'x' }}>Hello {'{{name}}'}</Trans>` },

    // Self-closing without count
    { code: `<Trans i18nKey="foo" />` },

    // Direct count prop + correct tOptions
    {
      code: `<Trans i18nKey="foo" count={n} tOptions={{ defaultValue_one: 'one', defaultValue_other: 'other' }}>x</Trans>`,
    },

    // count inside values + correct tOptions
    {
      code: `<Trans i18nKey="foo" values={{ count: n }} tOptions={{ defaultValue_one: 'one', defaultValue_other: 'other' }}>x</Trans>`,
    },

    // values is a non-literal expression — can't statically prove count is in there, so bail
    { code: `<Trans i18nKey="foo" values={someVar}>x</Trans>` },

    // tOptions is a non-literal expression — can't statically prove plural defaults missing, so bail
    { code: `<Trans i18nKey="foo" count={n} tOptions={someVar}>x</Trans>` },

    // Spread attribute on Trans — bail
    { code: `<Trans {...props}>x</Trans>` },

    // Not a Trans element
    { code: `<OtherComponent count={n}>x</OtherComponent>` },

    // Member-expression element (e.g. <i18n.Trans>) — out of scope
    { code: `<i18n.Trans count={n}>x</i18n.Trans>` },
  ],

  invalid: [
    // Pre-PR shape: count prop, no tOptions at all
    {
      code: `<Trans i18nKey="foo" count={n}>x</Trans>`,
      errors: [missingTOptions, missingDefaultValueOne, missingDefaultValueOther],
    },

    // count inside values, no tOptions
    {
      code: `<Trans i18nKey="foo" values={{ count: n }}>x</Trans>`,
      errors: [missingTOptions, missingDefaultValueOne, missingDefaultValueOther],
    },

    // tOptions present but empty
    {
      code: `<Trans i18nKey="foo" count={n} tOptions={{}}>x</Trans>`,
      errors: [missingDefaultValueOne, missingDefaultValueOther],
    },

    // tOptions has only defaultValue_one
    {
      code: `<Trans i18nKey="foo" count={n} tOptions={{ defaultValue_one: 'one' }}>x</Trans>`,
      errors: [missingDefaultValueOther],
    },

    // tOptions has only defaultValue_other
    {
      code: `<Trans i18nKey="foo" count={n} tOptions={{ defaultValue_other: 'other' }}>x</Trans>`,
      errors: [missingDefaultValueOne],
    },

    // count inside values + tOptions present but incomplete
    {
      code: `<Trans i18nKey="foo" values={{ count: n }} tOptions={{ defaultValue_one: 'one' }}>x</Trans>`,
      errors: [missingDefaultValueOther],
    },

    // Self-closing element with count
    {
      code: `<Trans i18nKey="foo" count={n} />`,
      errors: [missingTOptions, missingDefaultValueOne, missingDefaultValueOther],
    },

    // count as a shorthand inside values: { count } (i.e. `count` is in scope)
    {
      code: `<Trans i18nKey="foo" values={{ count }}>x</Trans>`,
      errors: [missingTOptions, missingDefaultValueOne, missingDefaultValueOther],
    },
  ],
});
