import { RuleTester } from 'eslint';

import noBorderRadiusLiteral from '../rules/no-border-radius-literal.cjs';

// TODO: `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
if (!global.structuredClone) {
  global.structuredClone = function structuredClone(objectToClone) {
    const stringified = JSON.stringify(objectToClone);
    const parsed = JSON.parse(stringified);
    return parsed;
  };
}

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
  ],

  invalid: [
    {
      code: `css({ borderRadius: '2px' })`,
      errors: [
        {
          message: 'Prefer using theme.shape.radius tokens instead of literal values.',
        },
      ],
    },
    {
      code: `css({ lineHeight: 1 }, { borderRadius: '2px' })`,
      errors: [
        {
          message: 'Prefer using theme.shape.radius tokens instead of literal values.',
        },
      ],
    },
    {
      code: `css([{ lineHeight: 1 }, { borderRadius: '2px' }])`,
      errors: [
        {
          message: 'Prefer using theme.shape.radius tokens instead of literal values.',
        },
      ],
    },
  ],
});
