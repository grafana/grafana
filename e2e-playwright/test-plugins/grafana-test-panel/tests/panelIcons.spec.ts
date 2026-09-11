import { test, expect } from '@grafana/plugin-e2e';

import { expectAllIconsLoaded } from './utils';

// Literal of VisualizationSelectPaneTab[VisualizationSelectPaneTab.Visualizations]
// (public/app/features/dashboard/components/PanelEditor/types.ts). Kept a literal to avoid
// importing core across the isolated test-plugin tsconfig boundary.
const ALL_VISUALIZATIONS_TAB = 'Visualizations';

test.describe('grafana-test-panel', { tag: ['@plugins'] }, () => {
  test('all panel type icons load in the visualization picker', async ({ gotoPanelEditPage, selectors }) => {
    const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: 'aBXrJ0R7z' }, id: '9' });

    await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
    await panelEditPage.getByGrafanaSelector(selectors.components.Tab.title(ALL_VISUALIZATIONS_TAB)).click();

    // Readiness signal: a core panel always present, so the async metas load has resolved.
    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.PluginVisualization.item('Text'))
    ).toBeVisible();

    // One card per panel type, with the <img> inside.
    const cards = panelEditPage.getByGrafanaSelector(selectors.components.PluginVisualization.item(''), {
      startsWith: true,
    });
    await expectAllIconsLoaded(cards, 5);
  });
});
