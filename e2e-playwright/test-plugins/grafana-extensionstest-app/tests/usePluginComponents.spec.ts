import { test, expect } from '@grafana/plugin-e2e';

import pluginJson from '../plugin.json';
import { testIds } from '../testIds';

test.describe(
  'grafana-extensionstest-app',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should render component with usePluginComponents hook', async ({ page }) => {
      await page.goto(`/a/${pluginJson.id}/added-components`);
      await expect(
        page.getByTestId(testIds.addedComponentsPage.container).getByTestId(testIds.appB.reusableAddedComponent)
      ).toHaveText('Hello World!');
    });
  }
);
