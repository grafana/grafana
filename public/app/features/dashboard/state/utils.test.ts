import { PanelModel } from './PanelModel';
import { isOnTheSameGridRow } from './utils';
import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';

describe('isOnTheSameGridRow', () => {
  describe('when source panel is next to a panel', () => {
    it('then it should return true', () => {
      const sourcePanel: PanelModel = ({ gridPos: { x: 0, y: 1, w: 4, h: 4 } } as unknown) as PanelModel;
      const otherPanel: PanelModel = ({ gridPos: { x: 4, y: 1, w: 4, h: 4 } } as unknown) as PanelModel;

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(true);
    });
  });

  describe('when source panel is not next to a panel', () => {
    it('then it should return false', () => {
      const sourcePanel: PanelModel = ({ gridPos: { x: 0, y: 1, w: 4, h: 4 } } as unknown) as PanelModel;
      const otherPanel: PanelModel = ({ gridPos: { x: 4, y: 5, w: 4, h: 4 } } as unknown) as PanelModel;

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
    });
  });

  describe('when source panel is repeated horizontally', () => {
    it('then it should return false', () => {
      const sourcePanel: PanelModel = ({
        gridPos: { x: 0, y: 1, w: 4, h: 4 },
        repeatDirection: REPEAT_DIR_HORIZONTAL,
      } as unknown) as PanelModel;
      const otherPanel: PanelModel = ({ gridPos: { x: 4, y: 1, w: 4, h: 4 } } as unknown) as PanelModel;

      expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
    });
  });
});
