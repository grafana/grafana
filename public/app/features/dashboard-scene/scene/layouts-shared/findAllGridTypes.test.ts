import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { hasDirectTabsChild } from './findAllGridTypes';

describe('hasDirectTabsChild', () => {
  it('should return false when layout is a bare tabs layout', () => {
    const layout = new TabsLayoutManager({
      tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    expect(hasDirectTabsChild(layout)).toBe(false);
  });

  it('should return false when layout is a grid layout', () => {
    const layout = AutoGridLayoutManager.createEmpty();
    expect(hasDirectTabsChild(layout)).toBe(false);
  });

  it('should return false when layout is RowsLayoutManager with no tabs in rows', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
      ],
    });
    expect(hasDirectTabsChild(layout)).toBe(false);
  });

  it('should return true when a direct child row holds a tabs layout', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new RowItem({
          layout: new TabsLayoutManager({
            tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
          }),
        }),
      ],
    });
    expect(hasDirectTabsChild(layout)).toBe(true);
  });

  it('should return true when any direct child row holds a tabs layout', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({
          layout: new TabsLayoutManager({
            tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
          }),
        }),
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
      ],
    });
    expect(hasDirectTabsChild(layout)).toBe(true);
  });

  it('should return false when tabs are nested deeper than a direct child (rows > rows > tabs)', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({
          layout: new RowsLayoutManager({
            rows: [
              new RowItem({
                layout: new TabsLayoutManager({
                  tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
                }),
              }),
            ],
          }),
        }),
      ],
    });
    expect(hasDirectTabsChild(layout)).toBe(false);
  });
});
