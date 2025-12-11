import { RuleTester } from 'eslint';

import noAriaLabelE2ESelector from '../rules/no-aria-label-e2e-selectors.cjs';

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
      name: 'direct aria-label usage',
      code: `<div aria-label="foo" />`,
    },
    {
      name: 'basic jsx expression container aria-label usage',
      code: `<div aria-label={"foo"} />`,
    },
    {
      name: 'imported from something else',
      code: `
import { someOtherImport } from './some-other-location';

<div aria-label={someOtherImport} />
      `,
    },
  ],
  invalid: [
    {
      name: 'imported from e2e-selectors package',
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
    {
      name: 'imported from elsewhere in e2e-selectors package',
      code: `
import { selectors } from '@grafana/e2e-selectors/src';

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
