import { RuleTester } from 'eslint';

import noUnreducedMotion from '../rules/no-unreduced-motion.cjs';

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

ruleTester.run('eslint no-unreduced-motion', noUnreducedMotion, {
  valid: [
    {
      name: 'basic case with handled preference',
      code: `
css({
  [theme.transitions.handleMotion('no-preference')]: {
    transition: 'opacity 0.5s ease-in-out',
  },
})
`,
    },
  ],
  invalid: [
    {
      name: 'basic case',
      code: `
css({
  transition: 'opacity 0.5s ease-in-out',
})
`,
      errors: 1,
    },
    {
      name: 'invalid usage in nested property or pseudo element',
      code: `
css({
  foo: {
  transition: 'opacity 0.5s ease-in-out',
  },
  '&:before': {
    transition: 'opacity 0.5s ease-in-out',
  },
})
  `,
      errors: 2,
    },
  ],
});
