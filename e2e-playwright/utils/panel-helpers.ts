import { expect } from '@playwright/test';

import { PanelEditPage } from '@grafana/plugin-e2e';

export async function setVisualization(page: PanelEditPage, visualization: string) {
  const showPanelEditElement = page.getByGrafanaSelector('Show options pane');
  const showPanelEditElementCount = await showPanelEditElement.count();
  if (showPanelEditElementCount > 0) {
    await showPanelEditElement.click();
  }
  await page.getByGrafanaSelector(page.ctx.selectors.components.PanelEditor.toggleVizPicker).click();
  await page.getByGrafanaSelector(page.ctx.selectors.components.Tab.title('All visualizations')).click();
  await page.getByGrafanaSelector(page.ctx.selectors.components.PluginVisualization.item(visualization)).click();

  const vizSelector = page.ctx.selectors.components.PanelEditor.toggleVizPicker;
  await expect(
    page.getByGrafanaSelector(vizSelector),
    `Could not set visualization to ${visualization}. Ensure the panel is installed.`
  ).toHaveText(visualization);
}
