import { test, expect } from '@grafana/plugin-e2e';
import { testIds } from '../testIds';
import pluginJson from '../plugin.json';

test('should display component exposed by another app', async ({ page }) => {
  await page.goto(`/a/${pluginJson.id}/exposed-components`);
  await expect(page.getByTestId(testIds.appB.exposedComponent)).toHaveText('Hello World!');
});
