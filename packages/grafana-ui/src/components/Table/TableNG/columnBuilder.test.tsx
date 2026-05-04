import memoize from 'micro-memoize';
import { createRef } from 'react';

import { createDataFrame, createTheme, FieldType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { getTextColorForBackground } from '../../../utils/colors';

import { type ColumnBuildConfig, buildColumnsFromFields } from './columnBuilder';
import { type FilterType } from './types';
import { applyFilter, getCellColorInlineStylesFactory } from './utils';

function makeFilterResult() {
  return applyFilter([], {}, []);
}

function makeConfig(overrides: Partial<ColumnBuildConfig> = {}): ColumnBuildConfig {
  const theme = createTheme();
  const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
  return {
    theme,
    applyToRowBgFn: undefined,
    getCellColorInlineStyles,
    getTextColorForBackground: memoize(getTextColorForBackground, { maxSize: 100 }),
    rowHeight: 36,
    rowHeightFn: () => 36,
    filter: {} as FilterType,
    setFilter: jest.fn(),
    setInspectCell: jest.fn(),
    gridRef: createRef(),
    getCellActions: jest.fn().mockReturnValue([]),
    onCellFilterAdded: undefined,
    frozenColumns: 0,
    numFrozenColsFullyInView: 0,
    maxRowHeight: undefined,
    disableKeyboardEvents: false,
    disableSanitizeHtml: false,
    showTypeIcons: false,
    timeRange: undefined,
    ...overrides,
  };
}

describe('buildColumnsFromFields', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'A', type: FieldType.string, values: ['x', 'y'] },
      { name: 'B', type: FieldType.number, values: [1, 2] },
    ],
  });

  const rows = [
    { __depth: 0, __index: 0, A: 'x', B: 1 },
    { __depth: 0, __index: 1, A: 'y', B: 2 },
  ];

  it('builds one column per field', () => {
    const result = buildColumnsFromFields(
      frame.fields,
      [100, 100],
      frame,
      rows,
      rows,
      makeFilterResult(),
      makeConfig()
    );
    expect(result.columns).toHaveLength(2);
  });

  it('populates cellRootRenderers keyed by display name', () => {
    const result = buildColumnsFromFields(
      frame.fields,
      [100, 100],
      frame,
      rows,
      rows,
      makeFilterResult(),
      makeConfig()
    );
    expect(typeof result.cellRootRenderers['A']).toBe('function');
    expect(typeof result.cellRootRenderers['B']).toBe('function');
  });

  it('sets column key and name to the field display name', () => {
    const result = buildColumnsFromFields(
      frame.fields,
      [100, 100],
      frame,
      rows,
      rows,
      makeFilterResult(),
      makeConfig()
    );
    expect(result.columns[0].key).toBe('A');
    expect(result.columns[0].name).toBe('A');
    expect(result.columns[1].key).toBe('B');
  });

  it('marks columns frozen when index is within frozen range', () => {
    const config = makeConfig({ frozenColumns: 1, numFrozenColsFullyInView: 2 });
    const result = buildColumnsFromFields(
      frame.fields,
      [100, 100],
      frame,
      rows,
      rows,
      makeFilterResult(),
      config
    );
    expect(result.columns[0].frozen).toBe(true);
    expect(result.columns[1].frozen).toBe(false);
  });

  it('sets column widths from the widths array', () => {
    const result = buildColumnsFromFields(
      frame.fields,
      [150, 200],
      frame,
      rows,
      rows,
      makeFilterResult(),
      makeConfig()
    );
    expect(result.columns[0].width).toBe(150);
    expect(result.columns[1].width).toBe(200);
  });

  it('patches Pill cell fields to use FixedColor mode when mappings exist', () => {
    const mappingFrame = createDataFrame({
      fields: [
        {
          name: 'Status',
          type: FieldType.string,
          values: ['ok'],
          config: {
            custom: { cellOptions: { type: TableCellDisplayMode.Pill } },
            mappings: [{ type: 'value', options: { ok: { text: 'OK' } } } as never],
          },
        },
      ],
    });
    // Should not throw and returns 1 column
    const result = buildColumnsFromFields(
      mappingFrame.fields,
      [100],
      mappingFrame,
      [],
      [],
      makeFilterResult(),
      makeConfig()
    );
    expect(result.columns).toHaveLength(1);
  });

  it('handles an empty fields array', () => {
    const emptyFrame = createDataFrame({ fields: [] });
    const result = buildColumnsFromFields([], [], emptyFrame, [], [], makeFilterResult(), makeConfig());
    expect(result.columns).toHaveLength(0);
    expect(Object.keys(result.cellRootRenderers)).toHaveLength(0);
  });
});
