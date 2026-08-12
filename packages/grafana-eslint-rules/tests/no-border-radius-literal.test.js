import { RuleTester } from 'eslint';

import noBorderRadiusLiteral from '../rules/no-border-radius-literal.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const useTokenError = {
  messageId: 'borderRadiusUseTokens',
};

const noZeroValueError = {
  messageId: 'borderRadiusNoZeroValue',
};

const ruleTester = new RuleTester();

ruleTester.run('eslint no-border-radius-literal', noBorderRadiusLiteral, {
  valid: [
    {
      code: `css({ borderRadius: theme.shape.radius.default })`,
    },
    {
      code: `css({ borderRadius: theme.shape.radius.circle })`,
    },
    {
      code: `css({ borderRadius: theme.shape.radius.pill })`,
    },
    {
      code: `css({ borderTopLeftRadius: theme.shape.radius.pill })`,
    },
    {
      code: `css({ borderTopRightRadius: theme.shape.radius.pill })`,
    },
    {
      code: `css({ borderBottomLeftRadius: theme.shape.radius.pill })`,
    },
    {
      code: `css({ borderBottomRightRadius: theme.shape.radius.pill })`,
    },

    // allow values to remove border radius
    {
      code: `css({ borderRadius: 'initial' })`,
    },
    {
      code: `css({ borderRadius: 'unset' })`,
    },
  ],

  invalid: [
    {
      code: `css({ borderRadius: '2px' })`,
      errors: [useTokenError],
    },
    {
      code: `css({ borderRadius: 2 })`, // should error on px shorthand
      errors: [useTokenError],
    },
    {
      code: `css({ lineHeight: 1 }, { borderRadius: '2px' })`,
      errors: [useTokenError],
    },
    {
      code: `css([{ lineHeight: 1 }, { borderRadius: '2px' }])`,
      errors: [useTokenError],
    },
    {
      name: 'nested classes',
      code: `
css({
  foo: {
    nested: {
      borderRadius: '100px',
    },
  },
})`,
      errors: [useTokenError],
    },
    {
      code: `css({ borderTopLeftRadius: 1 })`,
      errors: [useTokenError],
    },
    {
      code: `css({ borderTopRightRadius: "2px" })`,
      errors: [useTokenError],
    },
    {
      code: `css({ borderBottomLeftRadius: 3 })`,
      errors: [useTokenError],
    },
    {
      code: `css({ borderBottomRightRadius: "4px" })`,
      errors: [useTokenError],
    },

    // should use unset or initial to remove border radius
    {
      code: `css({ borderRadius: 0 })`,
      output: `css({ borderRadius: 'unset' })`,
      errors: [noZeroValueError],
    },
    {
      code: `css({ borderRadius: '0px' })`,
      output: `css({ borderRadius: 'unset' })`,
      errors: [noZeroValueError],
    },
    {
      code: `css({ borderRadius: "0%" })`,
      output: `css({ borderRadius: 'unset' })`,
      errors: [noZeroValueError],
    },
  ],
});
