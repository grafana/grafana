import { SortOrder } from '@grafana/schema';

import { VizLegendItem } from './types';
import { naturalCompare, sortLegendItems } from './utils';

function makeItem(label: string): VizLegendItem {
  return { label, yAxis: 1 };
}

describe('naturalCompare', () => {
  it('sorts numeric strings naturally', () => {
    const labels = ['series-10', 'series-2', 'series-1'];
    labels.sort(naturalCompare);
    expect(labels).toEqual(['series-1', 'series-2', 'series-10']);
  });
});

describe('sortLegendItems', () => {
  const items = [makeItem('Zebra'), makeItem('apple'), makeItem('Mango'), makeItem('banana')];

  it('returns items unchanged for SortOrder.None', () => {
    const result = sortLegendItems(items, SortOrder.None);
    expect(result).toBe(items); // same reference, not copied
  });

  it('returns items unchanged when sortOrder is undefined', () => {
    const result = sortLegendItems(items, undefined);
    expect(result).toBe(items);
  });

  it('sorts ascending (A-Z) case-insensitively', () => {
    const result = sortLegendItems(items, SortOrder.Ascending);
    expect(result.map((i) => i.label)).toEqual(['apple', 'banana', 'Mango', 'Zebra']);
  });

  it('sorts descending (Z-A) case-insensitively', () => {
    const result = sortLegendItems(items, SortOrder.Descending);
    expect(result.map((i) => i.label)).toEqual(['Zebra', 'Mango', 'banana', 'apple']);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    sortLegendItems(items, SortOrder.Ascending);
    expect(items.map((i) => i.label)).toEqual(original.map((i) => i.label));
  });

  it('handles natural numeric ordering', () => {
    const numericItems = [
      makeItem('series-10'),
      makeItem('series-2'),
      makeItem('series-1'),
      makeItem('series-20'),
      makeItem('series-3'),
    ];
    const result = sortLegendItems(numericItems, SortOrder.Ascending);
    expect(result.map((i) => i.label)).toEqual([
      'series-1',
      'series-2',
      'series-3',
      'series-10',
      'series-20',
    ]);
  });

  it('returns empty array unchanged', () => {
    const result = sortLegendItems([], SortOrder.Ascending);
    expect(result).toEqual([]);
  });
});
