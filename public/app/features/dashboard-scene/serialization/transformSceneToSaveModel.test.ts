import {
  MultiValueVariable,
  SceneDataLayers,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneVariable,
} from '@grafana/scenes';
import { Panel, RowPanel } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';

import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';

import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import repeatingRowsAndPanelsDashboardJson from './testfiles/repeating_rows_and_panels.json';
import { buildGridItemForPanel, transformSaveModelToScene } from './transformSaveModelToScene';
import { gridItemToPanel, transformSceneToSaveModel } from './transformSceneToSaveModel';

describe('transformSceneToSaveModel', () => {
  describe('Given a simple scene', () => {
    it('Should transform back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });

  describe('Given a scene with rows', () => {
    it('Should transform back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);
      const row2: RowPanel = saveModel.panels![2] as RowPanel;

      expect(row2.type).toBe('row');
      expect(row2.repeat).toBe('server');
      expect(saveModel).toMatchSnapshot();
    });

    it('Should remove repeated rows in save model', () => {
      const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson as any, meta: {} });

      const variable = scene.state.$variables?.state.variables[0] as MultiValueVariable;
      variable.changeValueTo(['a', 'b', 'c']);

      const grid = scene.state.body as SceneGridLayout;
      const rowWithRepeat = grid.state.children[1] as SceneGridRow;
      const rowRepeater = rowWithRepeat.state.$behaviors![0] as RowRepeaterBehavior;

      // trigger row repeater
      rowRepeater.variableDependency?.variableUpdatesCompleted(new Set<SceneVariable>([variable]));

      // Make sure the repeated rows have been added to runtime scene model
      expect(grid.state.children.length).toBe(5);

      const saveModel = transformSceneToSaveModel(scene);
      const rows = saveModel.panels!.filter((p) => p.type === 'row');
      // Verify the save model does not contain any repeated rows
      expect(rows.length).toBe(3);
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

  describe('Annotations', () => {
    it('should transform annotations to save model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel.annotations?.list?.length).toBe(4);
      expect(saveModel.annotations?.list).toMatchSnapshot();
    });
    it('should transform annotations to save model after state changes', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });

      const layers = (scene.state.$data as SceneDataLayers)?.state.layers;
      const enabledLayer = layers[1];
      const hiddenLayer = layers[3];

      enabledLayer.setState({
        isEnabled: false,
      });
      hiddenLayer.setState({
        isHidden: false,
      });

      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel.annotations?.list?.length).toBe(4);
      expect(saveModel.annotations?.list?.[1].enable).toEqual(false);
      expect(saveModel.annotations?.list?.[3].hide).toEqual(false);
    });
  });
});

export function buildGridItemFromPanelSchema(panel: Partial<Panel>): SceneGridItemLike {
  return buildGridItemForPanel(new PanelModel(panel));
}
