import { clsx } from 'clsx';
import { type CSSProperties, type JSX, useCallback, useMemo, useRef } from 'react';

import { FALLBACK_COLOR, FieldColorModeId, type Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { Cell, type DataGridHandle, type DataGridProps, type RenderCellProps } from '@grafana/react-data-grid';
import { TableCellDisplayMode } from '@grafana/schema';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { getTextColorForBackground } from '../../../../utils/colors';
import { usePanelContext } from '../../../PanelChrome';
import { getCellRenderer, getCellSpecificStyles } from '../Cells/renderers';
import { COLUMN, TABLE } from '../constants';
import { getDefaultCellStyles, getLinkStyles } from '../styles';
import {
  type CellRootRenderer,
  type GetActionsFunctionLocal,
  type TableColumn,
  type TableNGProps,
  type TableRow,
  type TableSummaryRow,
} from '../types';
import {
  canFieldBeColorized,
  displayJsonValue,
  getAlignment,
  getCellColorInlineStylesFactory,
  getCellOptions,
  getDefaultRowHeight,
  getDisplayName,
  getVisibleFields,
  shouldTextWrap,
} from '../utils';

import { TableDataGrid } from './TableDataGrid';
import { useDataGridRows } from './render-hooks';

// Key of the frozen field-name column. It is not a numeric value-column index, so it can never
// collide with one.
const FIELD_NAME_COL_KEY = '__fieldName';

// Rows-as-fields does not resolve links/actions per cell yet, so cells never surface actions.
const NOOP_GET_ACTIONS: GetActionsFunctionLocal = () => [];
const EMPTY_EXPANDED_ROWS: Set<string> = new Set();
const NOOP_STABLE_KEY = () => '';
const NOOP = () => {};

// Precomputed per-field rendering info. In this mode each row is a field, so the renderer, cell
// options, colorization and styles are resolved once per field and indexed by row.__index at
// render time — keeping cost O(fields) rather than O(fields * values).
interface FieldRenderInfo {
  field: Field;
  cellOptions: ReturnType<typeof getCellOptions>;
  cellType: TableCellDisplayMode;
  CellType: ReturnType<typeof getCellRenderer>;
  canBeColorized: boolean;
  cellParentStyles: string;
  cellSpecificStyles: string | undefined;
}

/**
 * Renders a table in "rows as fields" (pivoted) mode: each visible field becomes a row, column one
 * is a frozen list of field display names, and the remaining columns are the field values indexed by
 * the original row. Cell rendering and field overrides resolve per-row (from the field), so overrides
 * apply to the row. Header, sorting, filtering, and footers are intentionally disabled in this mode.
 */
export function TableRowsAsFields(props: TableNGProps) {
  const {
    cellHeight,
    data,
    disableKeyboardEvents,
    disableSanitizeHtml,
    enableVirtualization,
    noValue,
    timeRange,
    transparent,
    width,
  } = props;

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const gridRef = useRef<DataGridHandle>(null);

  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);

  // One row per field.
  const rows = useMemo<TableRow[]>(
    () => visibleFields.map((_, index) => ({ __index: index, __depth: 0 })),
    [visibleFields]
  );

  const fieldInfos = useMemo<FieldRenderInfo[]>(
    () =>
      visibleFields.map((original) => {
        let field = original;
        const cellOptions = getCellOptions(field);
        const cellType = cellOptions.type;

        // attach JSONCell custom display function to JSONView / other cell types
        if (cellType === TableCellDisplayMode.JSONView || field.type === FieldType.other) {
          field = { ...field };
          field.display = displayJsonValue(field);
        }

        // pill cells with mappings ignore thresholds and use the single-color calculator
        if (cellType === TableCellDisplayMode.Pill && (field.config.mappings?.length ?? 0) > 0) {
          field = {
            ...field,
            config: {
              ...field.config,
              color: {
                ...field.config.color,
                mode: FieldColorModeId.Fixed,
                fixedColor: field.config.color?.fixedColor ?? FALLBACK_COLOR,
              },
            },
          };
          field.display = getDisplayProcessor({ field, theme });
        }

        const textAlign = getAlignment(field);
        const styleOptions = { textAlign, textWrap: shouldTextWrap(field), shouldOverflow: false };
        const canBeColorized = canFieldBeColorized(cellType);

        return {
          field,
          cellOptions,
          cellType,
          CellType: getCellRenderer(field, cellOptions),
          canBeColorized,
          cellParentStyles: clsx(getDefaultCellStyles(theme, styleOptions), getLinkStyles(theme, canBeColorized)),
          cellSpecificStyles: getCellSpecificStyles(cellType, field, theme, styleOptions),
        };
      }),
    [visibleFields, theme]
  );

  // Number of value columns = number of original rows.
  const valueColCount = data.length ?? visibleFields[0]?.values.length ?? 0;

  const rowHeight = getDefaultRowHeight(theme, undefined, cellHeight);
  const rowHeightPx = typeof rowHeight === 'number' ? rowHeight : TABLE.MAX_CELL_HEIGHT;

  const { nameColWidth, valueColWidth } = useMemo(() => {
    const longestName = visibleFields.reduce((max, field) => Math.max(max, getDisplayName(field).length), 0);
    const nameWidth = Math.min(300, Math.max(COLUMN.MIN_WIDTH, longestName * 8 + 2 * TABLE.CELL_PADDING + 16));
    const remaining = width - nameWidth;
    const valueWidth =
      valueColCount > 0 && remaining > 0
        ? Math.max(COLUMN.MIN_WIDTH, Math.floor(remaining / valueColCount))
        : COLUMN.DEFAULT_WIDTH;
    return { nameColWidth: nameWidth, valueColWidth: valueWidth };
  }, [visibleFields, valueColCount, width]);

  const columns = useMemo<TableColumn[]>(() => {
    const placeholderField = visibleFields[0];

    const nameColumn: TableColumn = {
      key: FIELD_NAME_COL_KEY,
      name: '',
      field: placeholderField,
      width: nameColWidth,
      minWidth: COLUMN.MIN_WIDTH,
      frozen: true,
      sortable: false,
      renderCell: ({ row }) => <>{getDisplayName(visibleFields[row.__index])}</>,
    };

    const valueColumns: TableColumn[] = Array.from({ length: valueColCount }, (_, colIdx) => ({
      key: String(colIdx),
      name: '',
      field: placeholderField,
      width: valueColWidth,
      minWidth: COLUMN.MIN_WIDTH,
      frozen: false,
      sortable: false,
      renderCell: (cellProps: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
        const info = fieldInfos[cellProps.row.__index];
        if (info == null) {
          return <></>;
        }
        const CellType = info.CellType;
        return (
          <CellType
            cellOptions={info.cellOptions}
            frame={data}
            field={info.field}
            height={rowHeightPx}
            rowIdx={colIdx}
            theme={theme}
            value={info.field.values[colIdx]}
            width={valueColWidth}
            timeRange={timeRange}
            cellInspect={false}
            showFilters={false}
            getActions={NOOP_GET_ACTIONS}
            disableSanitizeHtml={disableSanitizeHtml}
            getTextColorForBackground={getTextColorForBackground}
          />
        );
      },
    }));

    return [nameColumn, ...valueColumns];
  }, [
    visibleFields,
    fieldInfos,
    valueColCount,
    nameColWidth,
    valueColWidth,
    rowHeightPx,
    data,
    theme,
    timeRange,
    disableSanitizeHtml,
  ]);

  const renderRow = useDataGridRows(data.fields, panelContext, EMPTY_EXPANDED_ROWS, false, NOOP_STABLE_KEY);

  const renderCellRoot = useCallback<CellRootRenderer>(
    (key, cellProps) => {
      const info = fieldInfos[cellProps.row.__index];
      if (cellProps.column.key === FIELD_NAME_COL_KEY || info == null) {
        return <Cell key={key} {...cellProps} />;
      }

      const style: CSSProperties = {};
      if (info.canBeColorized && info.field.display != null) {
        const colIdx = Number(cellProps.column.key);
        const displayValue = info.field.display(info.field.values[colIdx]);
        Object.assign(style, getCellColorInlineStyles(info.cellOptions, displayValue, false));
      }

      return (
        <Cell
          key={key}
          {...cellProps}
          className={clsx(cellProps.className, info.cellParentStyles, info.cellSpecificStyles)}
          style={style}
        />
      );
    },
    [fieldInfos, getCellColorInlineStyles]
  );

  const onCellKeyDown: NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellKeyDown']> = useCallback(
    (_args, event) => {
      if (disableKeyboardEvents) {
        event.preventGridDefault();
      }
    },
    [disableKeyboardEvents]
  );

  return (
    <TableDataGrid
      role="grid"
      gridRef={gridRef}
      columns={columns}
      rows={rows}
      noValue={noValue}
      renderers={{ renderRow, renderCell: renderCellRoot }}
      onCellClick={NOOP}
      onCellKeyDown={onCellKeyDown}
      sortColumns={[]}
      setSortColumns={NOOP}
      rowHeight={rowHeight}
      enableVirtualization={enableVirtualization}
      hasFooter={false}
      footerHeight={0}
      noHeader={true}
      headerHeight={0}
      transparent={transparent}
      sortedRows={rows}
      enablePagination={false}
      numRows={rows.length}
      page={0}
      setPage={NOOP}
      numPages={1}
      pageRangeStart={0}
      pageRangeEnd={rows.length}
      smallPagination={false}
      onTooltipClose={NOOP}
      inspectCell={null}
      onInspectCellDismiss={NOOP}
    />
  );
}
