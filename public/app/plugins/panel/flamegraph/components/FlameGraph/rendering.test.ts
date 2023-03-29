import { createTheme, getDisplayProcessor } from '@grafana/data';

import { ItemWithStart } from './dataTransform';
import { getRectDimensionsForLevel } from './rendering';

describe('getRectDimensionsForLevel', () => {
  it('should render a single item', () => {
    const level: ItemWithStart[] = [{ level: 1, start: 0, value: 100, label: '1', self: 0 }];
    const result = getRectDimensionsForLevel(
      level,
      1,
      100,
      0,
      10,
      getDisplayProcessor({ field: { config: {} }, theme: createTheme() }),
      (val) => val.toString()
    );
    expect(result).toEqual([
      {
        width: 999,
        height: 22,
        x: 0,
        y: 22,
        collapsed: false,
        ticks: 100,
        label: '1',
        unitLabel: '100',
      },
    ]);
  });

  it('should render a multiple items', () => {
    const level: ItemWithStart[] = [
      { level: 2, start: 0, value: 100, label: '1', self: 0 },
      { level: 2, start: 100, value: 50, label: '2', self: 0 },
      { level: 2, start: 150, value: 50, label: '3', self: 0 },
    ];
    const result = getRectDimensionsForLevel(
      level,
      2,
      100,
      0,
      10,
      getDisplayProcessor({ field: { config: {} }, theme: createTheme() }),
      (val) => val.toString()
    );
    expect(result).toEqual([
      { width: 999, height: 22, x: 0, y: 44, collapsed: false, ticks: 100, label: '1', unitLabel: '100' },
      { width: 499, height: 22, x: 1000, y: 44, collapsed: false, ticks: 50, label: '2', unitLabel: '50' },
      { width: 499, height: 22, x: 1500, y: 44, collapsed: false, ticks: 50, label: '3', unitLabel: '50' },
    ]);
  });

  it('should render a collapsed items', () => {
    const level: ItemWithStart[] = [
      { level: 2, start: 0, value: 100, label: '1', self: 0 },
      { level: 2, start: 100, value: 2, label: '2', self: 0 },
      { level: 2, start: 102, value: 1, label: '3', self: 0 },
    ];
    const result = getRectDimensionsForLevel(
      level,
      2,
      100,
      0,
      1,
      getDisplayProcessor({ field: { config: {} }, theme: createTheme() }),
      (val) => val.toString()
    );
    expect(result).toEqual([
      { width: 99, height: 22, x: 0, y: 44, collapsed: false, ticks: 100, label: '1', unitLabel: '100' },
      { width: 3, height: 22, x: 100, y: 44, collapsed: true, ticks: 3, label: '2', unitLabel: '2' },
    ]);
  });
});
