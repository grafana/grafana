import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { containsTabsLayout, findAllGridTypes } from './findAllGridTypes';

describe('findAllGridTypes', () => {
  it('should return grid type for a grid layout', () => {
    const layout = AutoGridLayoutManager.createEmpty();
    expect(findAllGridTypes(layout)).toEqual([AutoGridLayoutManager.descriptor.id]);
  });

  it('should return grid types from tabs', () => {
    const layout = new TabsLayoutManager({
      tabs: [
        new TabItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new TabItem({ layout: AutoGridLayoutManager.createEmpty() }),
      ],
    });
    expect(findAllGridTypes(layout)).toEqual([
      AutoGridLayoutManager.descriptor.id,
      AutoGridLayoutManager.descriptor.id,
    ]);
  });

  it('should return grid types from rows', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
      ],
    });
    expect(findAllGridTypes(layout)).toEqual([
      AutoGridLayoutManager.descriptor.id,
      AutoGridLayoutManager.descriptor.id,
    ]);
  });
});

describe('containsTabsLayout', () => {
  it('should return true when layout is TabsLayoutManager', () => {
    const layout = new TabsLayoutManager({
      tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    expect(containsTabsLayout(layout)).toBe(true);
  });

  it('should return false when layout is a grid layout', () => {
    const layout = AutoGridLayoutManager.createEmpty();
    expect(containsTabsLayout(layout)).toBe(false);
  });

  it('should return false when layout is RowsLayoutManager with no tabs in rows', () => {
    const layout = new RowsLayoutManager({
      rows: [
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
        new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
      ],
    });
    expect(containsTabsLayout(layout)).toBe(false);
  });

  it('should return true when RowsLayoutManager contains a row with tabs layout', () => {
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
    expect(containsTabsLayout(layout)).toBe(true);
  });

  it('should return true when any row contains tabs layout', () => {
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
    expect(containsTabsLayout(layout)).toBe(true);
  });
});
