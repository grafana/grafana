import { SceneGridItemLike } from '@grafana/scenes';
import { Panel } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';

import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import { buildGridItemForPanel, transformSaveModelToScene } from './transformSaveModelToScene';
import { gridItemToPanel, transformSceneToSaveModel } from './transformSceneToSaveModel';

describe('transformSceneToSaveModel', () => {
  describe('Given a scene', () => {
    it('Should transform back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });

  describe('Panel options', () => {
    it('Given panel with time override', () => {
      const gridItem = buildGridItemFromPanelSchema({
        timeFrom: '2h',
        timeShift: '1d',
        hideTimeOverride: true,
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.timeFrom).toBe('2h');
      expect(saveModel.timeShift).toBe('1d');
      expect(saveModel.hideTimeOverride).toBe(true);
    });

    it('transparent panel', () => {
      const gridItem = buildGridItemFromPanelSchema({ transparent: true });
      const saveModel = gridItemToPanel(gridItem);

      expect(saveModel.transparent).toBe(true);
    });

    it('Given panel with repeat', () => {
      const gridItem = buildGridItemFromPanelSchema({
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 1, y: 2, w: 12, h: 8 },
        repeat: 'server',
        repeatDirection: 'v',
        maxPerRow: 8,
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.repeat).toBe('server');
      expect(saveModel.repeatDirection).toBe('v');
      expect(saveModel.maxPerRow).toBe(8);
      expect(saveModel.gridPos?.x).toBe(1);
      expect(saveModel.gridPos?.y).toBe(2);
      expect(saveModel.gridPos?.w).toBe(12);
      expect(saveModel.gridPos?.h).toBe(8);
    });
  });
});

export function buildGridItemFromPanelSchema(panel: Partial<Panel>): SceneGridItemLike {
  return buildGridItemForPanel(new PanelModel(panel));
}
