import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { generateUniqueTitle, getDefaultLayout } from './utils';

describe('getDefaultLayout', () => {
  it('should create AutoGridLayoutManager by default when no items exist', () => {
    const result = getDefaultLayout([]);
    expect(result).toBeInstanceOf(AutoGridLayoutManager);
  });

  it('should create DefaultGridLayoutManager when last item has DefaultGridLayoutManager', () => {
    const result = getDefaultLayout([new RowItem({ layout: DefaultGridLayoutManager.createEmpty() })]);
    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should create AutoGridLayoutManager when last item has AutoGridLayoutManager', () => {
    const result = getDefaultLayout([new RowItem({ layout: AutoGridLayoutManager.createEmpty() })]);
    expect(result).toBeInstanceOf(AutoGridLayoutManager);
  });

  it('should create DefaultGridLayoutManager when last item has nested RowsLayoutManager with DefaultGridLayoutManager', () => {
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ layout: DefaultGridLayoutManager.createEmpty() })],
    });
    const result = getDefaultLayout([new RowItem({ layout: innerRows })]);
    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should create AutoGridLayoutManager when last item has nested RowsLayoutManager with AutoGridLayoutManager', () => {
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    const result = getDefaultLayout([new RowItem({ layout: innerRows })]);
    expect(result).toBeInstanceOf(AutoGridLayoutManager);
  });

  it('should create DefaultGridLayoutManager when last item has deeply nested TabsLayoutManager with DefaultGridLayoutManager', () => {
    const tabsLayout = new TabsLayoutManager({
      tabs: [new TabItem({ layout: DefaultGridLayoutManager.createEmpty() })],
    });
    const result = getDefaultLayout([new RowItem({ layout: tabsLayout })]);
    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should use deepest leaf from last sibling with multiple nesting levels', () => {
    const deepLayout = DefaultGridLayoutManager.createEmpty();
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ layout: deepLayout })],
    });
    const tabsLayout = new TabsLayoutManager({
      tabs: [new TabItem({ layout: innerRows })],
    });
    const result = getDefaultLayout([
      new RowItem({ layout: AutoGridLayoutManager.createEmpty() }),
      new RowItem({ layout: tabsLayout }),
    ]);
    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should work with TabItem as items', () => {
    const result = getDefaultLayout([new TabItem({ layout: DefaultGridLayoutManager.createEmpty() })]);
    expect(result).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should create AutoGridLayoutManager when last tab has nested RowsLayoutManager with AutoGridLayoutManager', () => {
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    const result = getDefaultLayout([new TabItem({ layout: innerRows })]);
    expect(result).toBeInstanceOf(AutoGridLayoutManager);
  });
});

describe('generateUniqueTitle', () => {
  it('should return the original title if it is not in the existing titles', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['Other Title', 'Another Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });

  it('should handle undefined title by using empty string as base', () => {
    const existingTitles = new Set<string>(['Title 1', 'Title 2']);
    expect(generateUniqueTitle(undefined, existingTitles)).toBe('');
  });

  it('should append "1" to a title that does not end with a number', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 1');
  });

  it('should increment a number at the end of a title', () => {
    const title = 'My Title 1';
    const existingTitles = new Set<string>(['My Title 1', 'My Title 2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 3');
  });

  it('should handle multiple increments when needed', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title', 'My Title 1', 'My Title 2', 'My Title 3']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 4');
  });

  it('should handle titles with multiple numbers', () => {
    const title = 'My Title 123';
    const existingTitles = new Set<string>(['My Title 123', 'My Title 124']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 125');
  });

  it('should handle titles with spaces before the number', () => {
    const title = 'My Title  1';
    const existingTitles = new Set<string>(['My Title  1', 'My Title  2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title  3');
  });

  it('should handle empty existing titles set', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>();
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });
});
