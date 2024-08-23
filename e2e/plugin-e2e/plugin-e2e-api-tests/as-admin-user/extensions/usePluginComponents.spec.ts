import { test, expect } from '@grafana/plugin-e2e';

const pluginId = 'grafana-extensionstest-app';
const exposedComponentTestId = 'exposed-component';

test('should render component with usePluginComponents hook', async ({ page }) => {
  await page.goto(`/a/${pluginId}/added-components`);
  await expect(
    page.getByTestId('data-testid pg-added-components-container').getByTestId('b-app-add-component')
  ).toHaveText('Hello World!');
});
