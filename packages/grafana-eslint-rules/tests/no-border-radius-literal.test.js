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

const expectedError = {
  messageId: 'borderRadiusId',
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

    // 0 is allowed for no border radius
    {
      code: `css({ borderRadius: 0 })`,
    },
  ],

  invalid: [
    {
      code: `css({ borderRadius: '2px' })`,
      errors: [expectedError],
    },
    {
      code: `css({ borderRadius: 2 })`, // should error on px shorthand
      errors: [expectedError],
    },
    {
      code: `css({ lineHeight: 1 }, { borderRadius: '2px' })`,
      errors: [expectedError],
    },
    {
      code: `css([{ lineHeight: 1 }, { borderRadius: '2px' }])`,
      errors: [expectedError],
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
      errors: [expectedError],
    },
    {
      code: `css({ borderTopLeftRadius: 1 })`,
      errors: [expectedError],
    },
    {
      code: `css({ borderTopRightRadius: "2px" })`,
      errors: [expectedError],
    },
    {
      code: `css({ borderBottomLeftRadius: 3 })`,
      errors: [expectedError],
    },
    {
      code: `css({ borderBottomRightRadius: "4px" })`,
      errors: [expectedError],
    },
  ],
});
