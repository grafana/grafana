import { RuleTester } from 'eslint';

import noTranslationTopLevel from './no-translation-top-level.cjs';

const ruleTester = new RuleTester({
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

// @ts-ignore
ruleTester.run('eslint no-translation-top-level', noTranslationTopLevel, {
  valid: [
    {
      name: 'invocation inside component',
      code: `
function Component() {
  return <div>{t('some.key', 'Some text')}</div>;
}
      `,
    },
    {
      name: 'invocation inside function',
      code: `const foo = () => t('some.key', 'Some text');`,
    },
    {
      name: 'invocation inside class component',
      code: `class Component {
        render() {
          return t('some.key', 'Some text');
          }
        }`,
    },
    {
      name: 'invocation of something not named t at top level',
      code: `const foo = ttt('some.key', 'Some text');`,
    },
  ],
  invalid: [
    {
      name: 'invocation at top level',
      code: `const thing = t('some.key', 'Some text');`,
      errors: 1,
    },
    {
      name: 'invocation in array',
      code: `const things = [t('some.key', 'Some text')];`,
      errors: 1,
    },
    {
      name: 'invocation in object',
      code: `const objectThings = [{foo: t('some.key', 'Some text')}];`,
      errors: 1,
    },
  ],
});
