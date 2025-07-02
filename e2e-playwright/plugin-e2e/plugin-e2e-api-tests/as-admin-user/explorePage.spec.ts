import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test('query data response should be OK when query is valid', async ({ explorePage }) => {
      await explorePage.datasource.set('gdev-testdata');
      await expect(
        explorePage.runQuery(),
        formatExpectError('Expected Explore query to execute successfully')
      ).toBeOK();
    });
  }
);
