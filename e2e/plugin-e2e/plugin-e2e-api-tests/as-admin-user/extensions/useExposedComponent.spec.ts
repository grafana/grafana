import { test, expect } from '@grafana/plugin-e2e';

const pluginId = 'grafana-extensionstest-app';
const exposedComponentTestId = 'exposed-component';

test('should display component exposed by another app', async ({ page }) => {
  await page.goto(`/a/${pluginId}/exposed-components`);
  await expect(await page.getByTestId(exposedComponentTestId)).toHaveText('Hello World!');
});
