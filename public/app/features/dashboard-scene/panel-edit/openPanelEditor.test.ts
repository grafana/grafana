import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';
import { testWithFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { testWithViewport } from '../utils/mobileViewportTestUtils';

import { openPanelEditor } from './openPanelEditor';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

function buildTestScene() {
  const panel = new VizPanel({ title: 'Panel A', key: 'panel-1', pluginId: 'table' });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: { canEdit: true },
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ key: 'griditem-1', x: 0, body: panel })],
      }),
    }),
  });
  scene.activate();
  return { scene, panel };
}

describe('openPanelEditor', () => {
  it('enters edit mode and loads the panel editor view when editing succeeds', async () => {
    const { scene, panel } = buildTestScene();
    expect(scene.state.isEditing).toBeFalsy();

    await openPanelEditor(scene, panel, true);

    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.editPanel).toBeDefined();
  });

  describe('when edit entry is blocked on mobile', () => {
    testWithFlags({ 'grafana.mobileEditDeprecation': true });

    testWithViewport('mobile');

    it('does not enter edit mode or load the panel editor view', async () => {
      const { scene, panel } = buildTestScene();
      const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

      await openPanelEditor(scene, panel, true);

      expect(onEnterEditMode).not.toHaveBeenCalled();
      expect(scene.state.isEditing).toBeFalsy();
      expect(scene.state.editPanel).toBeUndefined();
    });
  });
});
