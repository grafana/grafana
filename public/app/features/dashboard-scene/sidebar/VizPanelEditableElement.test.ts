import { waitFor } from '@testing-library/react';

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
import { activateFullSceneTree } from '../utils/test-utils';

import { VizPanelEditableElement } from './VizPanelEditableElement';

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
