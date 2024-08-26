import { test, expect } from '@grafana/plugin-e2e';

import pluginJson from '../plugin.json';
import { testIds } from '../testIds';

test('path link', async ({ page }) => {
  await page.goto(`/a/${pluginJson.id}/added-links`);
  await page.getByTestId(testIds.addedLinksPage.container).getByText('Basic link').click();
  await expect(page.getByTestId(testIds.appA.container)).toHaveText('Hello Grafana!');
});
