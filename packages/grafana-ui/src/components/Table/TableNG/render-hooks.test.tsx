/* eslint-disable testing-library/render-result-naming-convention */
import { render, renderHook, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import memoize from 'micro-memoize';
import { createRef, type Key } from 'react';
import { type RenderRowProps } from 'react-data-grid';

import {
  createDataFrame,
  createTheme,
  type DataFrame,
  type DataHoverEvent,
  type EventBus,
  type Field,
  FieldType,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { getTextColorForBackground } from '../../../utils/colors';
import { type PanelContext } from '../../PanelChrome';

import { type ColumnBuildConfig, useColumnBuilderFromFields, useDataGridRows } from './render-hooks';
import { type FilterType, type NestedRowEntry, type TableRow, type TableSummaryRow } from './types';
import { type ApplyFilterResult, applyFilter, getCellColorInlineStylesFactory } from './utils';

// -----------------------------------------------------------------------------
// useDataGridRows
// -----------------------------------------------------------------------------

jest.mock('react-data-grid', () => ({
  ...jest.requireActual('react-data-grid'),
  Row: ({ onMouseEnter, onMouseLeave, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="rdg-row" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...rest} />
  ),
}));

function makeEventBus(): jest.Mocked<EventBus> {
  return {
    publish: jest.fn(),
    getStream: jest.fn(),
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  };
}

function makePanelContext(eventBus: EventBus): PanelContext {
  return {
    eventsScope: 'test',
    eventBus,
    onSeriesColorChange: jest.fn(),
    onToggleSeriesVisibility: jest.fn(),
    canAddAnnotations: jest.fn(),
    canEditAnnotations: jest.fn(),
    canDeleteAnnotations: jest.fn(),
    onAnnotationCreate: jest.fn(),
    onAnnotationUpdate: jest.fn(),
    onAnnotationDelete: jest.fn(),
    onSelectRange: jest.fn(),
    onAddAdHocFilter: jest.fn(),
    instanceState: {},
    onInstanceStateChange: jest.fn(),
    onToggleLegendSort: jest.fn(),
    onUpdateData: jest.fn(),
  };
}

function makeTimeField(values: number[] = [1000, 2000, 3000]): Field {
  return { name: 'time', type: FieldType.time, values, config: {}, state: {} };
}

function makeStringField(): Field {
  return { name: 'value', type: FieldType.string, values: ['a', 'b', 'c'], config: {}, state: {} };
}

function makeRowProps(row: TableRow): RenderRowProps<TableRow, TableSummaryRow> {
  return { row } as unknown as RenderRowProps<TableRow, TableSummaryRow>;
}

type RowsHookArgs = Parameters<typeof useDataGridRows>;

function renderRowsHook(...args: RowsHookArgs) {
  return renderHook(
    ({ fields, panelContext, expandedRows, enableSharedCrosshair, getStableKey }) =>
      useDataGridRows(fields, panelContext, expandedRows, enableSharedCrosshair, getStableKey),
    {
      initialProps: {
        fields: args[0],
        panelContext: args[1],
        expandedRows: args[2],
        enableSharedCrosshair: args[3],
        getStableKey: args[4],
      },
    }
  );
}

function renderNode(key: Key, renderRow: ReturnType<typeof useDataGridRows>, row: TableRow) {
  const node = renderRow(key, makeRowProps(row));
  if (node === null) {
    return null;
  }
  return render(<>{node}</>);
}

describe('useDataGridRows', () => {
  const getStableKey = (idx: number) => `row-${idx}`;

  describe('nested child rows (__depth === 1)', () => {
    it('returns null when the parent row is not expanded', () => {
      const eventBus = makeEventBus();
      const { result } = renderRowsHook([], makePanelContext(eventBus), new Set(), false, getStableKey);
      const row: TableRow = { __depth: 1, __index: 2 };

      const rendered = renderNode('k', result.current, row);

      expect(rendered).toBeNull();
    });

    it('renders Row with aria-level and aria-expanded when parent is expanded', () => {
      const eventBus = makeEventBus();
      const expandedRows = new Set([getStableKey(2)]);
      const { result } = renderRowsHook([], makePanelContext(eventBus), expandedRows, false, getStableKey);
      const row: TableRow = { __depth: 1, __index: 2 };

      renderNode('k', result.current, row);

      const rowEl = screen.getByTestId('rdg-row');
      expect(rowEl).toBeInTheDocument();
      expect(rowEl).toHaveAttribute('aria-level', String(row.__index + 1));
      expect(rowEl).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('top-level rows (__depth !== 1)', () => {
    it('renders a Row without mouse handlers when enableSharedCrosshair is false', () => {
      const eventBus = makeEventBus();
      const { result } = renderRowsHook([makeTimeField()], makePanelContext(eventBus), new Set(), false, getStableKey);

      renderNode('k', result.current, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      expect(rowEl).toBeInTheDocument();

      rowEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('renders a Row without mouse handlers when there is no time field', () => {
      const eventBus = makeEventBus();
      const { result } = renderRowsHook([makeStringField()], makePanelContext(eventBus), new Set(), true, getStableKey);

      renderNode('k', result.current, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      rowEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes DataHoverEvent on mouse enter when enableSharedCrosshair is true and time field exists', async () => {
      const eventBus = makeEventBus();
      const timeValues = [1000, 2000, 3000];
      const { result } = renderRowsHook(
        [makeTimeField(timeValues)],
        makePanelContext(eventBus),
        new Set(),
        true,
        getStableKey
      );

      renderNode('k', result.current, { __depth: 0, __index: 1 });

      await userEvent.hover(screen.getByTestId('rdg-row'));

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-hover',
          payload: { point: { time: timeValues[1] } },
        })
      );
    });

    it('publishes DataHoverClearEvent on mouse leave', async () => {
      const eventBus = makeEventBus();
      const { result } = renderRowsHook([makeTimeField()], makePanelContext(eventBus), new Set(), true, getStableKey);

      renderNode('k', result.current, { __depth: 0, __index: 0 });

      const rowEl = screen.getByTestId('rdg-row');
      await userEvent.hover(rowEl);
      await userEvent.unhover(rowEl);

      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'data-hover-clear' }));
    });

    it('uses rowIdx from the row to look up the correct time value', async () => {
      const eventBus = makeEventBus();
      const timeValues = [100, 200, 300];
      const { result } = renderRowsHook(
        [makeTimeField(timeValues)],
        makePanelContext(eventBus),
        new Set(),
        true,
        getStableKey
      );

      renderNode('k', result.current, { __depth: 0, __index: 2 });

      await userEvent.hover(screen.getByTestId('rdg-row'));

      const call = (eventBus.publish as jest.Mock).mock.calls[0][0] as DataHoverEvent;
      expect(call.payload.point.time).toBe(timeValues[2]);
    });
  });

  describe('memoization', () => {
    it('returns the same render function across re-renders when inputs are stable', () => {
      const eventBus = makeEventBus();
      const fields: Field[] = [];
      const panelContext = makePanelContext(eventBus);
      const expandedRows = new Set<string>();
      const { result, rerender } = renderRowsHook(fields, panelContext, expandedRows, false, getStableKey);

      const first = result.current;
      rerender({
        fields,
        panelContext,
        expandedRows,
        enableSharedCrosshair: false,
        getStableKey,
      });

      expect(result.current).toBe(first);
    });

    it('returns a new render function when an input changes', () => {
      const eventBus = makeEventBus();
      const fields: Field[] = [];
      const panelContext = makePanelContext(eventBus);
      const expandedRows = new Set<string>();
      const { result, rerender } = renderRowsHook(fields, panelContext, expandedRows, false, getStableKey);

      const first = result.current;
      rerender({
        fields,
        panelContext,
        expandedRows,
        enableSharedCrosshair: true,
        getStableKey,
      });

      expect(result.current).not.toBe(first);
    });
  });
});

// -----------------------------------------------------------------------------
// useColumnBuilderFromFields
// -----------------------------------------------------------------------------

function makeFilterResult(): ApplyFilterResult {
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

type ColumnHookProps = {
  filterResult: ApplyFilterResult;
  config: ColumnBuildConfig;
  nestedRows?: NestedRowEntry[];
};

function renderColumnBuilderHook(initialProps: ColumnHookProps) {
  return renderHook(
    ({ filterResult, config, nestedRows }: ColumnHookProps) =>
      useColumnBuilderFromFields(filterResult, config, nestedRows),
    { initialProps }
  );
}

function callFromFields(
  hook: ReturnType<typeof renderColumnBuilderHook>,
  fields: Field[],
  widths: number[],
  frame: DataFrame,
  rawRows: TableRow[],
  visibleRows: TableRow[]
) {
  return hook.result.current(fields, widths, frame, rawRows, visibleRows);
}

describe('useColumnBuilderFromFields', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'A', type: FieldType.string, values: ['x', 'y'] },
      { name: 'B', type: FieldType.number, values: [1, 2] },
    ],
  });

  const rows: TableRow[] = [
    { __depth: 0, __index: 0, A: 'x', B: 1 },
    { __depth: 0, __index: 1, A: 'y', B: 2 },
  ];

  it('builds one column per field', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(result.columns).toHaveLength(2);
  });

  it('populates cellRootRenderers keyed by display name', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(typeof result.cellRootRenderers['A']).toBe('function');
    expect(typeof result.cellRootRenderers['B']).toBe('function');
  });

  it('sets column key and name to the field display name', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(result.columns[0].key).toBe('A');
    expect(result.columns[0].name).toBe('A');
    expect(result.columns[1].key).toBe('B');
  });

  it('marks columns frozen when index is within frozen range', () => {
    const config = makeConfig({ frozenColumns: 1, numFrozenColsFullyInView: 2 });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(result.columns[0].frozen).toBe(true);
    expect(result.columns[1].frozen).toBe(false);
  });

  it('sets column widths from the widths array', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [150, 200], frame, rows, rows);
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
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, mappingFrame.fields, [100], mappingFrame, [], []);
    expect(result.columns).toHaveLength(1);
  });

  it('handles an empty fields array', () => {
    const emptyFrame = createDataFrame({ fields: [] });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, [], [], emptyFrame, [], []);
    expect(result.columns).toHaveLength(0);
    expect(Object.keys(result.cellRootRenderers)).toHaveLength(0);
  });

  describe('memoization', () => {
    it('returns the same fromFields function across re-renders when inputs are stable', () => {
      const filterResult = makeFilterResult();
      const config = makeConfig();
      const hook = renderColumnBuilderHook({ filterResult, config });

      const first = hook.result.current;
      hook.rerender({ filterResult, config });

      expect(hook.result.current).toBe(first);
    });

    it('returns a new fromFields function when config changes', () => {
      const filterResult = makeFilterResult();
      const hook = renderColumnBuilderHook({ filterResult, config: makeConfig() });

      const first = hook.result.current;
      hook.rerender({ filterResult, config: makeConfig({ frozenColumns: 1 }) });

      expect(hook.result.current).not.toBe(first);
    });
  });

  describe('nested filter resolution', () => {
    it('uses the top-level filterResult when visibleRows have no __parentIndex', () => {
      const topLevel = makeFilterResult();
      const nestedFilter = makeFilterResult();
      const nestedRows: NestedRowEntry[] = [{ raw: [], final: [], filterResult: nestedFilter }];
      const hook = renderColumnBuilderHook({ filterResult: topLevel, config: makeConfig(), nestedRows });

      // No __parentIndex on the visible rows → top-level path.
      expect(() => callFromFields(hook, frame.fields, [100, 100], frame, rows, rows)).not.toThrow();
    });

    it('uses the per-parent filterResult when visibleRows[0] has __parentIndex set', () => {
      const topLevel = makeFilterResult();
      const nestedFilter = makeFilterResult();
      const nestedRows: NestedRowEntry[] = [{ raw: [], final: [], filterResult: nestedFilter }];
      const hook = renderColumnBuilderHook({ filterResult: topLevel, config: makeConfig(), nestedRows });

      const nestedVisible: TableRow[] = [{ __depth: 1, __index: 0, __parentIndex: 0, A: 'x', B: 1 }];

      const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, nestedVisible);
      expect(result.columns).toHaveLength(2);
    });

    it('falls back to the top-level filterResult when nestedRows is undefined', () => {
      const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
      const visibleWithParentIdx: TableRow[] = [{ __depth: 1, __index: 0, __parentIndex: 0, A: 'x', B: 1 }];

      // nestedRows is undefined → must not crash trying to read nestedRows[0].
      expect(() => callFromFields(hook, frame.fields, [100, 100], frame, rows, visibleWithParentIdx)).not.toThrow();
    });
  });
});
