import { RuleTester } from 'eslint';

import noTranslationTopLevel from './no-translation-top-level.cjs';

const expectedErrorMessage = 'Do not use the t() function outside of a component or function';

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
      code: `
function Component() {
  return <div>{t('some.key', 'Some text')}</div>;
}
      `,
    },
    {
      code: `const foo = () => t('some.key', 'Some text');`,
    },
    {
      code: `const foo = ttt('some.key', 'Some text');`,
    },
    {
      code: `class Component {
render() {
  return t('some.key', 'Some text');
}
}`,
    },
  ],
  invalid: [
    {
      code: `const thing = t('some.key', 'Some text');`,
      errors: [{ message: expectedErrorMessage }],
    },
    {
      code: `const things = [t('some.key', 'Some text')];`,
      errors: [{ message: expectedErrorMessage }],
    },
    {
      code: `const objectThings = [{foo: t('some.key', 'Some text')}];`,
      errors: [{ message: expectedErrorMessage }],
    },
  ],
});
