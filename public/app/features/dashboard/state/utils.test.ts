import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';

import { PanelModel } from './PanelModel';
import { deleteScopeVars, isOnTheSameGridRow } from './utils';

describe('isOnTheSameGridRow', () => {
  describe('when source panel is next to a panel', () => {
    it('then it should return true', () => {
      const sourcePanel = new PanelModel({ gridPos: { x: 0, y: 1, w: 4, h: 4 } });
      const otherPanel = new PanelModel({ gridPos: { x: 4, y: 1, w: 4, h: 4 } });

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(true);
    });
  });

  describe('when source panel is not next to a panel', () => {
    it('then it should return false', () => {
      const sourcePanel = new PanelModel({ gridPos: { x: 0, y: 1, w: 4, h: 4 } });
      const otherPanel = new PanelModel({ gridPos: { x: 4, y: 5, w: 4, h: 4 } });

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
    });
  });

  describe('when source panel is repeated horizontally', () => {
    it('then it should return false', () => {
      const sourcePanel = new PanelModel({
        gridPos: { x: 0, y: 1, w: 4, h: 4 },
        repeatDirection: REPEAT_DIR_HORIZONTAL,
      });
      const otherPanel = new PanelModel({ gridPos: { x: 4, y: 1, w: 4, h: 4 } });

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
    });
  });
});

describe('deleteScopeVars', () => {
  describe('when called with a collapsed row with panels', () => {
    it('then scopedVars should be deleted on the row and all collapsed panels', () => {
      const panel1 = new PanelModel({
        id: 1,
        type: 'row',
        collapsed: true,
        scopedVars: { job: { value: 'myjob', text: 'myjob' } },
        panels: [
          { id: 2, type: 'graph', title: 'Graph', scopedVars: { job: { value: 'myjob', text: 'myjob' } } },
          { id: 3, type: 'graph2', title: 'Graph2', scopedVars: { job: { value: 'myjob', text: 'myjob' } } },
        ],
      });

      expect(panel1.scopedVars).toBeDefined();
      expect(panel1.panels?.[0].scopedVars).toBeDefined();
      expect(panel1.panels?.[1].scopedVars).toBeDefined();

      deleteScopeVars([panel1]);

      expect(panel1.scopedVars).toBeUndefined();
      expect(panel1.panels?.[0].scopedVars).toBeUndefined();
      expect(panel1.panels?.[1].scopedVars).toBeUndefined();
    });
  });
});
