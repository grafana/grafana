import { defaultDashboard } from '@grafana/schema';
import { defaultPanelKind, defaultSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { InspectTab } from 'app/features/inspector/types';

import { type PanelInspectDrawer } from './PanelInspectDrawer';

describe('panel inspector registration', () => {
  it.each([
    { version: 'legacy' as const, tab: InspectTab.Data },
    { version: 'V2' as const, tab: InspectTab.Query },
  ])('opens the requested $tab tab for a panel on a $version dashboard before resolving', async ({ version, tab }) => {
    // Each transformation must supply its own registration, without inheriting the other case's opener.
    await jest.isolateModulesAsync(async () => {
      const { openPanelInspector } = await import('./panelInspectorOpener');
      const dashboard = await createDashboard(version);
      const [panel] = dashboard.state.body.getVizPanels();

      const opening = openPanelInspector(panel, tab);
      expect(dashboard.state.overlay).toBeUndefined();
      await opening;

      // Capture before another await so importing the drawer class cannot hide an early resolution.
      const drawer = dashboard.state.overlay as PanelInspectDrawer;
      const { PanelInspectDrawer } = await import('./PanelInspectDrawer');

      expect(drawer).toBeInstanceOf(PanelInspectDrawer);
      expect(drawer.state.currentTab).toBe(tab);
      expect(drawer.state.panelRef.resolve()).toBe(panel);
      expect(drawer.getDrawerTitle()).toBe('Inspect: Request rate');
    });
  });
});

async function createDashboard(version: 'legacy' | 'V2') {
  if (version === 'legacy') {
    const { transformSaveModelToScene } = await import('../serialization/transformSaveModelToScene');

    return transformSaveModelToScene({
      dashboard: {
        ...defaultDashboard,
        uid: 'inspector-dashboard',
        title: 'Inspector dashboard',
        panels: [
          {
            id: 1,
            type: 'timeseries',
            title: 'Request rate',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
          },
        ],
      },
      meta: {},
    });
  }

  const { transformSaveModelSchemaV2ToScene } = await import('../serialization/transformSaveModelSchemaV2ToScene');
  const panel = defaultPanelKind();
  panel.spec.id = 1;
  panel.spec.title = 'Request rate';
  panel.spec.vizConfig.group = 'timeseries';

  return transformSaveModelSchemaV2ToScene({
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'v2',
    metadata: {
      name: 'inspector-dashboard',
      resourceVersion: '1',
      creationTimestamp: '2026-01-01T00:00:00Z',
    },
    access: {},
    spec: {
      ...defaultSpec(),
      title: 'Inspector dashboard',
      elements: { 'panel-1': panel },
      layout: {
        kind: 'GridLayout',
        spec: {
          items: [
            {
              kind: 'GridLayoutItem',
              spec: {
                element: { kind: 'ElementReference', name: 'panel-1' },
                x: 0,
                y: 0,
                width: 12,
                height: 8,
              },
            },
          ],
        },
      },
    },
  });
}
