import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('VariablePage', () => {
      test('clickAddNew should navigate to variable edit page', async ({ variablePage }) => {
        await variablePage.goto();
        const variableEditPage = await variablePage.clickAddNew();
        await expect(
          variableEditPage.ctx.page.url(),
          formatExpectError('Expected URL to contain the new variable path')
        ).toContain('variables');
      });
    });
  }
);
