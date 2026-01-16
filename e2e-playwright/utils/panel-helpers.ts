import { expect } from '@playwright/test';

import { PanelEditPage } from '@grafana/plugin-e2e';

export async function setVisualization(page: PanelEditPage, visualization: string) {
  const showPanelEditElement = page.getByGrafanaSelector('Show options pane');
  const showPanelEditElementCount = await showPanelEditElement.count();
  if (showPanelEditElementCount > 0) {
    await showPanelEditElement.click();
  }

  // with suggestions changes, the vizpicker may be open by default, which would mean we
  // want to skip this click.
  const vizPicker = page.getByGrafanaSelector(page.ctx.selectors.components.PanelEditor.toggleVizPicker);
  if ((await vizPicker.filter({ hasText: 'Back' }).count()) === 0) {
    await vizPicker.click();
  }

  await page.getByGrafanaSelector(page.ctx.selectors.components.Tab.title('All visualizations')).click();
  await page.getByGrafanaSelector(page.ctx.selectors.components.PluginVisualization.item(visualization)).click();

  await expect(
    page.getByGrafanaSelector(page.ctx.selectors.components.PanelEditor.OptionsPane.header),
    `Could not set visualization to ${visualization}. Ensure the panel is installed.`
  ).toHaveText(visualization);
}
