/* eslint-disable testing-library/render-result-naming-convention */
import { render, renderHook, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import memoize from 'micro-memoize';
import { type ComponentProps, createRef, isValidElement, type Key } from 'react';

import {
  createDataFrame,
  createTheme,
  type DataFrame,
  type DataHoverEvent,
  type EventBus,
  type Field,
  FieldColorModeId,
  FieldType,
} from '@grafana/data';
import { type CalculatedColumn, type RenderRowProps } from '@grafana/react-data-grid';
import { TableCellDisplayMode } from '@grafana/schema';

import { getTextColorForBackground } from '../../../utils/colors';
import { type PanelContext } from '../../PanelChrome';

import { type HeaderCell } from './components/HeaderCell';
import { type ColumnBuildConfig, useColumnBuilderFromFields, useDataGridRows } from './render-hooks';
import { type FilterType, type NestedRowEntry, type TableColumn, type TableRow, type TableSummaryRow } from './types';
import { type ApplyFilterResult, applyFilter, getCellColorInlineStylesFactory } from './utils';

// -----------------------------------------------------------------------------
// useDataGridRows
// -----------------------------------------------------------------------------

jest.mock('@grafana/react-data-grid', () => ({
  ...jest.requireActual('@grafana/react-data-grid'),
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

/**
 * With an empty filter, `crossFilterTailRows` is just the depth-0 rows, so passing distinct rows
 * gives each filter result an identifiable fingerprint to assert on.
 */
function makeFilterResult(scopedRows: TableRow[] = []): ApplyFilterResult {
  return applyFilter(scopedRows, {}, []);
}

/**
 * The resolved filter result is only observable through the props the column hands to `HeaderCell`.
 */
function getHeaderCellProps(column: TableColumn): ComponentProps<typeof HeaderCell> {
  const node = column.renderHeaderCell?.({
    // The grid augments each column into a CalculatedColumn before rendering; the header cell
    // only reads the properties the column already carries.
    column: column as unknown as CalculatedColumn<TableRow, TableSummaryRow>,
    sortDirection: undefined,
    priority: undefined,
    tabIndex: -1,
  });
  if (!isValidElement<ComponentProps<typeof HeaderCell>>(node)) {
    throw new Error(`renderHeaderCell did not return an element for column "${column.key}"`);
  }
  return node.props;
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

  it('builds one column per field, keyed and named by the field display name', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(result.columns.map((c) => c.key)).toEqual(['A', 'B']);
    expect(result.columns.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('populates cellRootRenderers keyed by display name', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(typeof result.cellRootRenderers['A']).toBe('function');
    expect(typeof result.cellRootRenderers['B']).toBe('function');
  });

  it('marks columns frozen when index is within frozen range', () => {
    const config = makeConfig({ frozenColumns: 1, numFrozenColsFullyInView: 2 });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config });
    const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);
    expect(result.columns[0].frozen).toBe(true);
    expect(result.columns[1].frozen).toBe(false);
  });

  it('is sortable by default, and only opts out when custom.sortable is explicitly false', () => {
    const unsortableFrame = createDataFrame({
      fields: [
        { name: 'A', type: FieldType.string, values: ['x', 'y'] },
        { name: 'B', type: FieldType.number, values: [1, 2], config: { custom: { sortable: false } } },
        { name: 'C', type: FieldType.number, values: [1, 2], config: { custom: { sortable: true } } },
      ],
    });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, unsortableFrame.fields, [100, 100, 100], unsortableFrame, rows, rows);
    expect(result.columns.map((c) => c.sortable)).toEqual([true, false, true]);
  });

  it('sets column widths from the widths array', () => {
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, frame.fields, [150, 200], frame, rows, rows);
    expect(result.columns[0].width).toBe(150);
    expect(result.columns[1].width).toBe(200);
  });

  function makePillFrame({ withMappings }: { withMappings: boolean }): DataFrame {
    return createDataFrame({
      fields: [
        {
          name: 'Status',
          type: FieldType.string,
          values: ['ok'],
          config: {
            custom: { cellOptions: { type: TableCellDisplayMode.Pill } },
            mappings: withMappings ? [{ type: 'value', options: { ok: { text: 'OK' } } } as never] : undefined,
          },
        },
      ],
    });
  }

  it('patches Pill cell fields to FixedColor mode with the fallback color when mappings exist', () => {
    const mappingFrame = makePillFrame({ withMappings: true });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });

    const result = callFromFields(hook, mappingFrame.fields, [100], mappingFrame, [], []);

    expect(result.columns[0].field.config.color).toEqual({ mode: FieldColorModeId.Fixed, fixedColor: '#808080' });
    // The patched display processor applies the mapped text but takes its color from Fixed mode.
    const display = result.columns[0].field.display!('ok');
    expect(display.text).toBe('OK');
    expect(display.color).toBe('#808080');
    // The frame's own field must not be mutated — only the column's copy is patched.
    expect(mappingFrame.fields[0].config.color).toBeUndefined();
  });

  it('leaves Pill cell fields untouched when there are no mappings', () => {
    const pillFrame = makePillFrame({ withMappings: false });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });

    const result = callFromFields(hook, pillFrame.fields, [100], pillFrame, [], []);

    expect(result.columns[0].field.config.color).toBeUndefined();
  });

  it('builds no columns and no cell renderers for an empty fields array', () => {
    const emptyFrame = createDataFrame({ fields: [] });
    const hook = renderColumnBuilderHook({ filterResult: makeFilterResult(), config: makeConfig() });
    const result = callFromFields(hook, [], [], emptyFrame, [], []);
    expect(result.columns).toEqual([]);
    expect(result.cellRootRenderers).toEqual({});
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
    const topLevelScope: TableRow[] = [{ __depth: 0, __index: 0, A: 'top-level-scope', B: 1 }];
    const perParentScope: TableRow[] = [{ __depth: 0, __index: 0, A: 'per-parent-scope', B: 2 }];
    const nestedVisible: TableRow[] = [{ __depth: 1, __index: 0, __parentIndex: 0, A: 'x', B: 1 }];

    function makeNestedRows(): NestedRowEntry[] {
      return [{ raw: [], final: [], filterResult: makeFilterResult(perParentScope) }];
    }

    it('uses the top-level filterResult when visibleRows have no __parentIndex', () => {
      const hook = renderColumnBuilderHook({
        filterResult: makeFilterResult(topLevelScope),
        config: makeConfig(),
        nestedRows: makeNestedRows(),
      });

      const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, rows);

      const headerProps = getHeaderCellProps(result.columns[0]);
      expect(headerProps.crossFilterTailRows).toEqual(topLevelScope);
      expect(headerProps.parentIndex).toBeUndefined();
    });

    it('uses the per-parent filterResult when visibleRows[0] has __parentIndex set', () => {
      const hook = renderColumnBuilderHook({
        filterResult: makeFilterResult(topLevelScope),
        config: makeConfig(),
        nestedRows: makeNestedRows(),
      });

      const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, nestedVisible);

      const headerProps = getHeaderCellProps(result.columns[0]);
      expect(headerProps.crossFilterTailRows).toEqual(perParentScope);
      expect(headerProps.parentIndex).toBe(0);
    });

    it('falls back to the top-level filterResult when nestedRows is undefined', () => {
      const hook = renderColumnBuilderHook({
        filterResult: makeFilterResult(topLevelScope),
        config: makeConfig(),
      });

      const result = callFromFields(hook, frame.fields, [100, 100], frame, rows, nestedVisible);

      const headerProps = getHeaderCellProps(result.columns[0]);
      expect(headerProps.crossFilterTailRows).toEqual(topLevelScope);
    });
  });
});
