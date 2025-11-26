import { expect, E2ESelectorGroups, PanelEditPage } from '@grafana/plugin-e2e';

// this replaces the panelEditPage.setVisualization method used previously in tests, since it
// does not know how to use the updated 12.4 viz picker UI to set the visualization
export const setVisualization = async (panelEditPage: PanelEditPage, vizName: string, selectors: E2ESelectorGroups) => {
  const vizPicker = panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);
  await expect(vizPicker, '"Change" button should be visible').toBeVisible();
  await vizPicker.click();

  const allVizTabBtn = panelEditPage.getByGrafanaSelector(selectors.components.Tab.title('All visualizations'));
  await expect(allVizTabBtn, '"All visualiations" button should be visible').toBeVisible();
  await allVizTabBtn.click();

  const vizItem = panelEditPage.getByGrafanaSelector(selectors.components.PluginVisualization.item(vizName));
  await expect(vizItem, `"${vizName}" item should be visible`).toBeVisible();
  await vizItem.scrollIntoViewIfNeeded();
  await vizItem.click();

  await expect(vizPicker, '"Change" button should be visible again').toBeVisible();
  await expect(
    panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header),
    'Panel header should have the new viz type name'
  ).toHaveText(vizName);
};
