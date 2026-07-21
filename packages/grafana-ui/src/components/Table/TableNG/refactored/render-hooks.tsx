import { clsx } from 'clsx';
import {
  type CSSProperties,
  type Dispatch,
  type JSX,
  type Key,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useCallback,
  useMemo,
} from 'react';

import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  type DataFrame,
  type Field,
  FieldType,
  type GrafanaTheme2,
  getDisplayProcessor,
  type TimeRange,
} from '@grafana/data';
import {
  Cell,
  type CellRendererProps,
  type DataGridHandle,
  type RenderCellProps,
  type RenderRowProps,
  Row,
} from '@grafana/react-data-grid';
import {
  FieldColorModeId,
  TableCellDisplayMode,
  TableCellTooltipPlacement,
  type TableFooterOptions,
} from '@grafana/schema';

import { type PanelContext } from '../../../PanelChrome';
import { getCellRenderer, getCellSpecificStyles } from '../Cells/renderers';
import { HeaderCell } from '../components/HeaderCell';
import { SummaryCell } from '../components/SummaryCell';
import { TableCellActions } from '../components/TableCellActions';
import { TableCellTooltip } from '../components/TableCellTooltip';
import {
  getCellActionStyles,
  getDefaultCellStyles,
  getHeaderCellStyles,
  getLinkStyles,
  getMaxHeightCellStyles,
  getTooltipStyles,
  getJustifyContent,
  IS_SAFARI_26,
} from '../styles';
import {
  type CellRootRenderer,
  type FilterType,
  type FromFieldsResult,
  type GetActionsFunctionLocal,
  type InspectCellProps,
  type NestedRowEntry,
  type TableCellStyleOptions,
  type TableFilterActionCallback,
  type TableRow,
  type TableSummaryRow,
} from '../types';
import {
  type ApplyFilterResult,
  canFieldBeColorized,
  displayJsonValue,
  getAlignment,
  type getCellColorInlineStylesFactory,
  getCellOptions,
  getDisplayName,
  getSummaryCellTextAlign,
  isCellInspectEnabled,
  parseStyleJson,
  predicateByName,
  shouldTextOverflow,
  shouldTextWrap,
} from '../utils';

// -----------------------------------------------------------------------------
// useDataGridRows
// -----------------------------------------------------------------------------

/**
 * @internal
 * Memoized renderer for the `renderRow` prop on DataGrid. Applies aria attributes and
 * shared-crosshair event handlers.
 */
export function useDataGridRows(
  fields: Field[],
  panelContext: PanelContext,
  expandedRows: Set<string>,
  enableSharedCrosshair: boolean,
  getStableKey: (rowIdx: number) => string
): (key: Key, props: RenderRowProps<TableRow, TableSummaryRow>) => ReactNode {
  return useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      (key: Key, props: RenderRowProps<TableRow, TableSummaryRow>): ReactNode => {
        const { row } = props;
        const rowIdx = row.__index;
        const isExpanded = expandedRows.has(getStableKey(rowIdx));

        // Don't render non-expanded child rows
        if (row.__depth === 1) {
          if (!isExpanded) {
            return null;
          }
          return <Row key={key} aria-level={row.__index + 1} aria-expanded={isExpanded} {...props} />;
        }

        const handlers: Partial<typeof props> = {};
        if (enableSharedCrosshair) {
          const timeField = fields.find((f) => f.type === FieldType.time);
          if (timeField) {
            handlers.onMouseEnter = () => {
              panelContext.eventBus.publish(
                new DataHoverEvent({
                  point: {
                    time: timeField?.values[rowIdx],
                  },
                })
              );
            };
            handlers.onMouseLeave = () => {
              panelContext.eventBus.publish(new DataHoverClearEvent());
            };
          }
        }

        return <Row key={key} {...props} {...handlers} />;
      },
    [fields, panelContext, expandedRows, enableSharedCrosshair, getStableKey]
  );
}

// -----------------------------------------------------------------------------
// useColumnBuilderFromFields
// -----------------------------------------------------------------------------

export interface ColumnBuildConfig {
  applyToRowBgFn: ((rowIdx: number) => Partial<CSSProperties>) | undefined;
  disableKeyboardEvents?: boolean;
  disableSanitizeHtml?: boolean;
  filter: FilterType;
  frozenColumns: number;
  getCellActions: GetActionsFunctionLocal;
  getCellColorInlineStyles: ReturnType<typeof getCellColorInlineStylesFactory>;
  getTextColorForBackground: (color: string) => string;
  gridRef: RefObject<DataGridHandle | null>;
  maxRowHeight?: number;
  numFrozenColsFullyInView: number;
  onCellFilterAdded?: TableFilterActionCallback;
  rowHeight: NonNullable<CSSProperties['height']> | ((row: TableRow) => number);
  rowHeightFn: (row: TableRow) => number;
  setFilter: Dispatch<SetStateAction<FilterType>>;
  setInspectCell: Dispatch<SetStateAction<InspectCellProps | null>>;
  showTypeIcons?: boolean;
  theme: GrafanaTheme2;
  timeRange?: TimeRange;
}

export type FromFieldsFn = (
  fields: Field[],
  widths: number[],
  frame: DataFrame,
  rawRows: TableRow[],
  visibleRows: TableRow[]
) => FromFieldsResult;

/**
 * Builds column definitions and cell root renderers from a set of fields.
 * Internal: callers should use `useColumnBuilderFromFields`, which memoizes the
 * per-call closure and resolves `resolvedFilterResult` (flat → top-level filterResult,
 * nested → per-parent via `parentIndex`).
 */
function buildColumnsFromFields(
  fields: Field[],
  widths: number[],
  frame: DataFrame,
  rawRows: TableRow[],
  visibleRows: TableRow[],
  resolvedFilterResult: ApplyFilterResult,
  config: ColumnBuildConfig
): FromFieldsResult {
  const {
    theme,
    applyToRowBgFn,
    getCellColorInlineStyles,
    getTextColorForBackground,
    rowHeight,
    rowHeightFn,
    filter,
    setFilter,
    setInspectCell,
    gridRef,
    getCellActions,
    onCellFilterAdded,
    frozenColumns,
    numFrozenColsFullyInView,
    maxRowHeight,
    disableKeyboardEvents,
    disableSanitizeHtml,
    showTypeIcons,
    timeRange,
  } = config;

  const result: FromFieldsResult = {
    columns: [],
    cellRootRenderers: {},
  };

  const fieldFooters: Array<TableFooterOptions | undefined> = [];
  let isFieldUniformFooter = true;
  let firstFooterReducers: string[] | undefined;
  for (const field of fields) {
    const footer = field.config?.custom?.footer;
    const reducers: string[] | undefined = footer?.reducers;

    fieldFooters.push(footer);

    // if reducers are undefined or empty on the footer, don't retain them for comparison.
    if (reducers === undefined || reducers.length === 0) {
      continue;
    }

    // first time we encounter a viable footer config, store it and move on.
    if (firstFooterReducers === undefined) {
      firstFooterReducers = reducers;
      continue;
    }

    // for all other viable footer configs, check to see if the reducers match the first one we encountered.
    if (reducers.length !== firstFooterReducers.length || reducers.some((r, idx) => firstFooterReducers?.[idx] !== r)) {
      isFieldUniformFooter = false;
      break;
    }
  }

  // Caller resolves whether to use the top-level or per-parent filter result.
  const parentIndex = visibleRows[0]?.__parentIndex;
  const { crossFilterRows, crossFilterTailRows } = resolvedFilterResult;

  let lastRowIdx = -1;
  // shared when whole row will be styled by a single cell's color
  let rowCellStyle: Partial<CSSProperties> = {
    color: undefined,
    background: undefined,
  };

  for (let i = 0; i < fields.length; i++) {
    let field = fields[i];
    const cellOptions = getCellOptions(field);
    const cellType = cellOptions.type;

    // make sure we use mappings exclusively if they exist, ignore default thresholds mode
    // we hack this by using the single color mode calculator
    if (cellType === TableCellDisplayMode.Pill && (field.config.mappings?.length ?? 0 > 0)) {
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

    // attach JSONCell custom display function to JSONView cell type
    if (cellType === TableCellDisplayMode.JSONView || field.type === FieldType.other) {
      field.display = displayJsonValue(field);
    }

    // For some cells, "aligning" the cell will mean aligning the inline contents of the cell with
    // the text-align css property, and for others, we'll use justify-content to align the cell
    // contents with flexbox. We always just get both and provide both when styling the cell.
    const textAlign = getAlignment(field);
    const justifyContent = getJustifyContent(textAlign);
    const displayName = getDisplayName(field);
    const headerCellClass = getHeaderCellStyles(theme, justifyContent);
    const CellType = getCellRenderer(field, cellOptions);

    const cellInspect = isCellInspectEnabled(field);
    const showFilters = Boolean(field.config.filterable && onCellFilterAdded != null);
    const showActions = cellInspect || showFilters;
    const width = widths[i];

    // helps us avoid string cx and emotion per-cell
    const cellActionClassName = showActions
      ? clsx('table-cell-actions', getCellActionStyles(theme, textAlign))
      : undefined;

    const shouldOverflow =
      !IS_SAFARI_26 && typeof rowHeight !== 'string' && (shouldTextOverflow(field) || Boolean(maxRowHeight));
    const textWrap = typeof rowHeight === 'string' || shouldTextWrap(field);
    const canBeColorized = canFieldBeColorized(cellType, applyToRowBgFn);
    const fieldAppliesToRow =
      cellOptions.type === TableCellDisplayMode.ColorBackground && cellOptions.applyToRow === true;
    const cellStyleOptions: TableCellStyleOptions = {
      textAlign,
      textWrap,
      shouldOverflow,
      maxHeight: maxRowHeight,
    };

    const defaultCellStyles = getDefaultCellStyles(theme, cellStyleOptions);
    const cellSpecificStyles = getCellSpecificStyles(cellType, field, theme, cellStyleOptions);
    const linkStyles = getLinkStyles(theme, canBeColorized);
    const cellParentStyles = clsx(defaultCellStyles, linkStyles);
    const maxHeightClassName = maxRowHeight ? getMaxHeightCellStyles(theme, cellStyleOptions) : undefined;
    const styleFieldValue = field.config.custom?.styleField;
    const styleField = styleFieldValue ? frame.fields.find(predicateByName(styleFieldValue)) : undefined;
    const styleFieldName = styleField ? getDisplayName(styleField) : undefined;
    const hasValidStyleField = Boolean(styleFieldName);

    // TODO: in future extend this to ensure a non-classic color scheme is set with AutoCell

    // this fires first
    const renderCellRoot: CellRootRenderer = (
      key: Key,
      props: CellRendererProps<TableRow, TableSummaryRow>
    ): ReactNode => {
      const rowIdx = props.row.__index;

      // meh, this should be cached by the renderRow() call?
      if (rowIdx !== lastRowIdx) {
        lastRowIdx = rowIdx;

        rowCellStyle.color = undefined;
        rowCellStyle.background = undefined;

        // generate shared styles for whole row
        if (applyToRowBgFn != null) {
          rowCellStyle = { ...rowCellStyle, ...applyToRowBgFn(rowIdx) };
        }
      }

      let style: CSSProperties = { ...rowCellStyle };
      // When this field itself opts into applyToRow, it defers to the shared row color
      // (chosen from the first such field) rather than painting its own color over it.
      if (canBeColorized && !fieldAppliesToRow) {
        const value = props.row[props.column.key];
        const displayValue = field.display!(value); // this fires here to get colors, then again to get rendered value?
        const cellColorStyles = getCellColorInlineStyles(cellOptions, displayValue, applyToRowBgFn != null);
        Object.assign(style, cellColorStyles);
      }
      if (hasValidStyleField) {
        style = { ...style, ...parseStyleJson(props.row[styleFieldName!]) };
      }

      return (
        <Cell
          key={key}
          {...props}
          className={clsx(
            props.className,
            cellParentStyles,
            cellSpecificStyles != null && maxRowHeight == null ? cellSpecificStyles : ''
          )}
          style={style}
        />
      );
    };

    result.cellRootRenderers[displayName] = renderCellRoot;

    const renderBasicCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
      const rowIdx = props.row.__index;
      const value = props.row[props.column.key];
      // TODO: it would be nice to get rid of passing height down as a prop. but this value
      // is cached so the cost of calling for every cell is low.
      // NOTE: some cell types still require a height to be passed down, so that's why string-based
      // cell types are going to just pass down the max cell height as a numeric height for those cells.
      const height = rowHeightFn(props.row);

      let cellResult = (
        <>
          <CellType
            cellOptions={cellOptions}
            frame={frame}
            field={field}
            height={height}
            rowIdx={rowIdx}
            theme={theme}
            value={value}
            width={width}
            timeRange={timeRange}
            cellInspect={cellInspect}
            showFilters={showFilters}
            getActions={getCellActions}
            disableSanitizeHtml={disableSanitizeHtml}
            getTextColorForBackground={getTextColorForBackground}
          />
          {showActions && (
            <TableCellActions
              field={field}
              value={value}
              displayName={displayName}
              cellInspect={cellInspect}
              showFilters={showFilters}
              className={cellActionClassName}
              setInspectCell={setInspectCell}
              onCellFilterAdded={onCellFilterAdded}
            />
          )}
        </>
      );

      if (maxRowHeight != null) {
        cellResult = <div className={clsx(maxHeightClassName, cellSpecificStyles)}>{cellResult}</div>;
      }

      return cellResult;
    };

    // renderCellContent fires second.
    let renderCellContent = renderBasicCellContent;

    const tooltipFieldName = field.config.custom?.tooltip?.field;
    if (tooltipFieldName) {
      const tooltipField = frame.fields.find(predicateByName(tooltipFieldName));
      if (tooltipField) {
        const tooltipDisplayName = getDisplayName(tooltipField);
        const tooltipCellOptions = getCellOptions(tooltipField);
        const tooltipFieldRenderer = getCellRenderer(tooltipField, tooltipCellOptions);

        const tooltipCellStyleOptions = {
          textAlign: getAlignment(tooltipField),
          // tooltips are free-floating overlays that should reveal the full value, so we
          // always wrap their content and never inherit the per-row cell-height clamp
          // (which would line-clamp/cut off the content).
          textWrap: true,
          shouldOverflow: false,
        } satisfies TableCellStyleOptions;
        const tooltipCanBeColorized = canFieldBeColorized(tooltipCellOptions.type, applyToRowBgFn);
        const tooltipDefaultStyles = getDefaultCellStyles(theme, tooltipCellStyleOptions);
        const tooltipSpecificStyles = getCellSpecificStyles(
          tooltipCellOptions.type,
          tooltipField,
          theme,
          tooltipCellStyleOptions
        );
        const tooltipLinkStyles = getLinkStyles(theme, tooltipCanBeColorized);
        const tooltipClasses = getTooltipStyles(theme, textAlign);

        const placement = field.config.custom?.tooltip?.placement ?? TableCellTooltipPlacement.Auto;
        const tooltipWidth =
          placement === TableCellTooltipPlacement.Left || placement === TableCellTooltipPlacement.Right
            ? tooltipField.config.custom?.width
            : width;

        const tooltipProps = {
          cellOptions: tooltipCellOptions,
          classes: tooltipClasses,
          className: clsx(
            tooltipClasses.tooltipContent,
            tooltipDefaultStyles,
            tooltipSpecificStyles,
            tooltipLinkStyles
          ),
          data: frame,
          disableSanitizeHtml,
          field: tooltipField,
          getActions: getCellActions,
          getTextColorForBackground,
          gridRef,
          placement,
          renderer: tooltipFieldRenderer,
          theme,
          width: tooltipWidth,
        } satisfies Partial<React.ComponentProps<typeof TableCellTooltip>>;

        renderCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
          // cached so we don't care about multiple calls.
          const tooltipHeight = rowHeightFn(props.row);
          let tooltipStyle: CSSProperties = { ...rowCellStyle };
          if (tooltipCanBeColorized) {
            const tooltipDisplayValue = tooltipField.display!(props.row[tooltipDisplayName]);
            const tooltipCellColorStyles = getCellColorInlineStyles(
              tooltipCellOptions,
              tooltipDisplayValue,
              applyToRowBgFn != null
            );
            Object.assign(tooltipStyle, tooltipCellColorStyles);
          }

          return (
            <TableCellTooltip {...tooltipProps} height={tooltipHeight} rowIdx={props.row.__index} style={tooltipStyle}>
              {renderBasicCellContent(props)}
            </TableCellTooltip>
          );
        };
      }
    }

    result.columns.push({
      field,
      key: displayName,
      name: displayName,
      width,
      headerCellClass,
      frozen: Math.min(frozenColumns, numFrozenColsFullyInView) > i,
      renderCell: renderCellContent,
      renderHeaderCell: ({ column, sortDirection }) => (
        <HeaderCell
          column={column}
          rows={rawRows}
          field={field}
          filter={filter}
          setFilter={setFilter}
          disableKeyboardEvents={disableKeyboardEvents}
          direction={sortDirection}
          showTypeIcons={showTypeIcons}
          parentIndex={parentIndex}
          crossFilterRows={crossFilterRows}
          crossFilterTailRows={crossFilterTailRows}
          selectFirstCell={() => {
            gridRef.current?.selectCell({ rowIdx: 0, idx: 0 });
          }}
        />
      ),
      renderSummaryCell: () => (
        <SummaryCell
          rows={visibleRows}
          footers={fieldFooters}
          field={field}
          colIdx={i}
          textAlign={getSummaryCellTextAlign(textAlign, cellType)}
          rowLabel={isFieldUniformFooter && i === 0}
          hideLabel={isFieldUniformFooter && i !== 0}
        />
      ),
    });
  }

  return result;
}

/**
 * @internal
 * Memoized factory for the per-call `fromFields` function consumed by TableFlat / TableNested.
 * When `nestedRows` is provided, the filter result is resolved per-call from the parent index;
 * otherwise the top-level `filterResult` is used directly.
 */
export function useColumnBuilderFromFields(
  filterResult: ApplyFilterResult,
  config: ColumnBuildConfig,
  nestedRows?: NestedRowEntry[]
): FromFieldsFn {
  return useCallback(
    (fields, widths, frame, rawRows, visibleRows) => {
      const parentIndex = visibleRows[0]?.__parentIndex;
      const resolvedFilterResult =
        parentIndex == null || nestedRows == null ? filterResult : nestedRows[parentIndex].filterResult;
      return buildColumnsFromFields(fields, widths, frame, rawRows, visibleRows, resolvedFilterResult, config);
    },
    [filterResult, nestedRows, config]
  );
}
