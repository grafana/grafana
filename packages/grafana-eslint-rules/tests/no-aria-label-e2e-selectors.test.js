import { RuleTester } from 'eslint';

import noAriaLabelE2ESelector from '../rules/no-aria-label-e2e-selectors.cjs';

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

ruleTester.run('eslint no-aria-label-e2e-selector', noAriaLabelE2ESelector, {
  valid: [
    {
      code: `<div aria-label="foo" />`,
    },
    {
      code: `<div aria-label={"foo"} />`,
    },
    {
      code: `
import { someOtherImport } from './some-other-location';

<div aria-label={someOtherImport} />
      `,
    },
  ],
  invalid: [
    {
      code: `
import { selectors } from '@grafana/e2e-selectors';

<div aria-label={selectors.pages.AddDashboard.addNewPanel} />
      `,
      errors: [
        {
          message: 'Use data-testid for E2E selectors instead of aria-label',
        },
      ],
    },
  ],
});
