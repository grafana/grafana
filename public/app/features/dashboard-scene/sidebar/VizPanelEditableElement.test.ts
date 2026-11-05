import { waitFor } from '@testing-library/react';
import { testWithFeatureToggles } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

import { ConditionalRenderingGroup } from '../conditional-rendering/group/ConditionalRenderingGroup';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { VizPanelEditableElement } from './VizPanelEditableElement';

function buildSelectedPanelsScene() {
  const panels = [1, 2, 3].map((id) => new VizPanel({ key: `panel-${id}`, pluginId: 'timeseries' }));
  const layout = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: panels.map((panel) => new AutoGridItem({ body: panel })) }),
  });
  const scene = new DashboardScene({ body: layout, isEditing: true });
  const elements = panels.slice(0, 2).map((panel) => new VizPanelEditableElement(panel));
  const selection = elements[0].createMultiSelectedElement(elements);

  return { scene, layout, selection };
}

describe('VizPanelEditableElement with dashboardNewLayouts enabled', () => {
  testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });

  it('when a sidebar selection is deleted, only selected panels are removed in one undoable action with edit-pane tracking', () => {
    const { scene, layout, selection } = buildSelectedPanelsScene();
    const track = jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const deactivate = activateFullSceneTree(scene);

    try {
      selection.onDelete();

      expect(layout.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-3']);
      expect(
        scene.state.sidebar.state.undoStack.map((action) => ({
          description: action.description,
          meta: action.meta,
        }))
      ).toEqual([{ description: 'Remove panels (2)', meta: { actionId: 'panel.remove', scope: 'multiple' } }]);
      expect(track.mock.calls).toEqual([
        ['delete', 1, 'edit_pane'],
        ['delete', 2, 'edit_pane'],
      ]);

      scene.state.sidebar.undoAction();

      expect(
        layout
          .getVizPanels()
          .map((panel) => panel.state.key)
          .sort()
      ).toEqual(['panel-1', 'panel-2', 'panel-3']);
      expect(scene.state.sidebar.state.undoStack).toEqual([]);

      scene.state.sidebar.redoAction();

      expect(layout.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-3']);
      expect(scene.state.sidebar.state.redoStack).toEqual([]);
    } finally {
      deactivate();
      track.mockRestore();
    }
  });
});

describe('VizPanelEditableElement', () => {
  describe('getEditableElementInfo', () => {
    it('returns isHidden=true when parent AutoGridItem conditionalRendering result is false', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      // Constructing AutoGridItem sets panel.parent automatically
      new AutoGridItem({
        body: panel,
        conditionalRendering: new ConditionalRenderingGroup({
          conditions: [],
          visibility: 'show',
          condition: 'and',
          result: false,
          renderHidden: false,
        }),
      });

      const element = new VizPanelEditableElement(panel);
      expect(element.getEditableElementInfo().isHidden).toBe(true);
    });

    it('returns isHidden=false when parent AutoGridItem conditionalRendering result is true', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      new AutoGridItem({
        body: panel,
        conditionalRendering: ConditionalRenderingGroup.createEmpty(), // result: true
      });

      const element = new VizPanelEditableElement(panel);
      expect(element.getEditableElementInfo().isHidden).toBe(false);
    });

    it('returns isHidden=false when parent AutoGridItem has no conditionalRendering (defaults to empty group with result=true)', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      new AutoGridItem({ body: panel });

      const element = new VizPanelEditableElement(panel);
      expect(element.getEditableElementInfo().isHidden).toBe(false);
    });

    it('returns isHidden=true for a repeated panel whose repeatedConditionalRendering result is false', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      const repeatedPanel = new VizPanel({ title: 'My Panel (repeat)' });
      new AutoGridItem({
        body: panel,
        repeatedPanels: [repeatedPanel],
        repeatedConditionalRendering: [
          new ConditionalRenderingGroup({
            conditions: [],
            visibility: 'show',
            condition: 'and',
            result: false,
            renderHidden: false,
          }),
        ],
      });

      const element = new VizPanelEditableElement(repeatedPanel);
      expect(element.getEditableElementInfo().isHidden).toBe(true);
    });

    it('returns isHidden=false for a repeated panel when AutoGridItem has no conditional rendering configured', async () => {
      const panel = new VizPanel({ title: 'My Panel' });
      const gridItem = new AutoGridItem({ body: panel, variableName: 'env' });
      const scene = new DashboardScene({
        $variables: new SceneVariableSet({
          variables: [
            new TestVariable({
              name: 'env',
              value: ALL_VARIABLE_VALUE,
              text: ALL_VARIABLE_TEXT,
              isMulti: true,
              includeAll: true,
              delayMs: 0,
              optionsToReturn: [
                { label: 'A', value: 'A' },
                { label: 'B', value: 'B' },
              ],
            }),
          ],
        }),
        body: new AutoGridLayoutManager({
          layout: new AutoGridLayout({ children: [gridItem] }),
        }),
      });

      activateFullSceneTree(scene);

      await waitFor(() => {
        expect(gridItem.state.repeatedPanels?.length).toBeGreaterThan(0);
      });

      const element = new VizPanelEditableElement(gridItem.state.repeatedPanels![0]);
      expect(element.getEditableElementInfo().isHidden).toBe(false);
    });

    it('returns isHidden=undefined when parent is a DashboardGridItem', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      new DashboardGridItem({ body: panel, x: 0, y: 0, width: 12, height: 6 });

      const element = new VizPanelEditableElement(panel);
      expect(element.getEditableElementInfo().isHidden).toBeUndefined();
    });
  });
});
