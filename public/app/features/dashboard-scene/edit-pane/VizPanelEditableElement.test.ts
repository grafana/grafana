import { VizPanel } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../conditional-rendering/group/ConditionalRenderingGroup';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

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

    it('returns isHidden=undefined when parent is a DashboardGridItem', () => {
      const panel = new VizPanel({ title: 'My Panel' });
      new DashboardGridItem({ body: panel, x: 0, y: 0, width: 12, height: 6 });

      const element = new VizPanelEditableElement(panel);
      expect(element.getEditableElementInfo().isHidden).toBeUndefined();
    });
  });
});
