import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

const EXTENSIONS_TEST_APP = 'grafana-extensionstest-app';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('gotoAppConfigPage', () => {
      test('should navigate to app config page', async ({ gotoAppConfigPage, page }) => {
        const configPage = await gotoAppConfigPage({ pluginId: EXTENSIONS_TEST_APP });
        await expect(page.url(), formatExpectError('Expected URL to contain app config path')).toContain(
          `/plugins/${EXTENSIONS_TEST_APP}`
        );
      });
    });

    test.describe('gotoAppPage', () => {
      test('should navigate to app page with default path', async ({ gotoAppPage, page }) => {
        const appPage = await gotoAppPage({ pluginId: EXTENSIONS_TEST_APP });
        await expect(page.url(), formatExpectError('Expected URL to contain app page path')).toContain(
          `/a/${EXTENSIONS_TEST_APP}`
        );
      });

      test('should navigate to app page with custom path', async ({ gotoAppPage, page }) => {
        const appPage = await gotoAppPage({ pluginId: EXTENSIONS_TEST_APP, path: '/added-links' });
        await expect(page.url(), formatExpectError('Expected URL to contain the custom app page path')).toContain(
          `/a/${EXTENSIONS_TEST_APP}/added-links`
        );
      });
    });

    test.describe('AppPage', () => {
      test('goto should navigate to a specific app page path', async ({ gotoAppPage, page }) => {
        const appPage = await gotoAppPage({ pluginId: EXTENSIONS_TEST_APP });
        await appPage.goto({ path: '/exposed-components' });
        await expect(page.url(), formatExpectError('Expected URL to contain the navigated path')).toContain(
          `/a/${EXTENSIONS_TEST_APP}/exposed-components`
        );
      });
    });
  }
);
