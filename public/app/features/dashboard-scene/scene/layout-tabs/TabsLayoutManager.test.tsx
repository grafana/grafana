import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

describe('TabsLayoutManager', () => {
  describe('url sync', () => {
    it('when on top level', () => {
      const tabsLayoutManager = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Performance' })],
      });

      const urlState = tabsLayoutManager.getUrlState();
      expect(urlState).toEqual({ dtab: 'performance' });
    });

    it('when nested under row and parent tab', () => {
      const innerMostTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Performance' })],
      });

      new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Overview',
            layout: new TabsLayoutManager({
              tabs: [
                new TabItem({
                  title: 'Frontend',
                  layout: innerMostTabs,
                }),
              ],
            }),
          }),
        ],
      });

      const urlState = innerMostTabs.getUrlState();
      expect(urlState).toEqual({
        ['overview-frontend-dtab']: 'performance',
      });
    });
  });
});
