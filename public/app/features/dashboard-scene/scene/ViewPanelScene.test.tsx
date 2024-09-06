import { LocalValueVariable, SceneGridLayout, SceneGridRow, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene } from './DashboardScene';
import { ViewPanelScene } from './ViewPanelScene';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => {}),
  }),
}));

describe('ViewPanelScene', () => {
  it('Should activate panel parents', () => {
    const { viewPanelScene, dashboard } = buildScene();
    viewPanelScene.activate();
    expect(viewPanelScene.state.panelRef.resolve().isActive).toBe(true);
    expect(dashboard.state.body.isActive).toBe(true);
  });
});

interface SceneOptions {
  rowVariables?: boolean;
  panelVariables?: boolean;
}

function buildScene(options?: SceneOptions) {
  // builds a scene how it looks like after row and panel repeats are processed
  const panel = new VizPanel({
    key: 'panel-22',
  });

  const dashboard = new DashboardScene({
    body: new SceneGridLayout({
      children: [
        new SceneGridRow({
          x: 0,
          y: 10,
          width: 24,
          $variables: new SceneVariableSet({
            variables: [new LocalValueVariable({ value: 'row-var-value' })],
          }),
          height: 1,
          children: [
            new DashboardGridItem({
              body: panel,
            }),
          ],
        }),
      ],
    }),
  });

  const viewPanelScene = new ViewPanelScene({ panelRef: panel.getRef() });

  return { viewPanelScene, dashboard };
}
