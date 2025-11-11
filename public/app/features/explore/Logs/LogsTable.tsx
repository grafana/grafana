import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  CustomTransformOperator,
  DataFrame,
  DataFrameType,
  DataTransformerConfig,
  Field,
  FieldType,
  guessFieldTypeForField,
  LogsSortOrder,
  sortDataFrame,
  SplitOpen,
  TimeRange,
  transformDataFrame,
  urlUtil,
  ValueLinkConfig,
  AbsoluteTimeRange,
  LogRowModel,
  ExploreLogsPanelState,
  GrafanaTheme2,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { AdHocFilterItem, CustomCellRendererProps, Table, TableCellDisplayMode, useTheme2 } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { DETECTED_LEVEL, LEVEL, LogsFrame } from 'app/features/logs/logsFrame';

import { getFieldLinksForExplore } from '../utils/links';

import { LogsTableActionButtons } from './LogsTableActionButtons';
import { FieldNameMeta } from './LogsTableWrap';

interface Props {
  dataFrame: DataFrame;
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  columnsWithMeta: Record<string, FieldNameMeta>;
  height: number;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  logsFrame: LogsFrame | null;
  sortBy?: Array<{ displayName: string; desc?: boolean }>;
  onSortByChange?: (sortBy: Array<{ displayName: string; desc?: boolean }>) => void;
  exploreId?: string;
  displayedFields?: string[];
  visualisationType?: 'table' | 'logs';
  panelState?: ExploreLogsPanelState;
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
}

const DEFAULT_COLUMN_WIDTH = 200;
const FIRST_COLUMN_WIDTH = 40;

const getStyles = (theme: GrafanaTheme2) => ({
  firstColumnHeader: css({
    display: 'flex',
    label: 'wrapper',
    marginLeft: theme.spacing(7),
    width: '100%',
  }),
  firstColumnCell: css({
    paddingLeft: theme.spacing(7),
  }),
});

export function LogsTable(props: Props) {
  const { timeZone, splitOpen, range, logsSortOrder, width, dataFrame, columnsWithMeta, logsFrame } = props;
  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);
  const [columnWidthMap, setColumnWidthMap] = useState<Record<string, number>>({});
  const timeIndex = logsFrame?.timeField.index;
  const theme = useTheme2();
  const styles = getStyles(theme);

  // Extract selected log ID from URL parameter
  const selectedLogInfo = useMemo(() => {
    const { selectedLine } = urlUtil.getUrlSearchParams();

    const param = Array.isArray(selectedLine) ? selectedLine[0] : selectedLine;

    if (typeof param !== 'string') {
      return undefined;
    }

    try {
      const { id, row } = JSON.parse(param);
      return { id, row };
    } catch (error) {
      return undefined;
    }
  }, []);

  // Find the row index by log ID (matching logs-drilldown approach)
  const initialRowIndex = useMemo(() => {
    if (!selectedLogInfo || !logsFrame?.idField) {
      return undefined;
    }

    // Search in logsFrame.idField.values (raw data, not transformed)
    const lineIndex = logsFrame.idField.values.findIndex((v) => v === selectedLogInfo.id);
    const cleanLineIndex = lineIndex !== -1 ? lineIndex : undefined;

    return cleanLineIndex;
  }, [selectedLogInfo, logsFrame?.idField]);

  // Clear the selectedLine URL parameter after table loads
  useEffect(() => {
    if (initialRowIndex !== undefined && tableFrame) {
      // Remove selectedLine from URL after initial render
      const params = urlUtil.getUrlSearchParams();
      delete params.selectedLine;
      const newUrl = urlUtil.renderUrl(window.location.pathname, params);
      window.history.replaceState({}, '', newUrl);
    }
  }, [initialRowIndex, tableFrame]);

  const onColumnResize = useCallback((fieldDisplayName: string, width: number) => {
    if (width > 0) {
      setColumnWidthMap((prev) => ({
        ...prev,
        [fieldDisplayName]: width,
      }));
    }
  }, []);

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
      if (!frame.length) {
        return frame;
      }

      const sortedFrame = sortDataFrame(frame, timeIndex, logsSortOrder === LogsSortOrder.Descending);

      const [frameWithOverrides] = applyFieldOverrides({
        data: [sortedFrame],
        timeZone,
        theme: config.theme2,
        replaceVariables: (v: string) => v,
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      });
      // `getLinks` and `applyFieldOverrides` are taken from TableContainer.tsx
      for (const [index, field] of frameWithOverrides.fields.entries()) {
        field.getLinks = (config: ValueLinkConfig) => {
          return getFieldLinksForExplore({
            field,
            rowIndex: config.valueRowIndex!,
            splitOpenFn: splitOpen,
            range: range,
            dataFrame: sortedFrame!,
          });
        };

        // For the first field (time), wrap the cell to include action buttons
        const isFirstField = index === 0;
        const isBodyField = field.name === logsFrame?.bodyField.name;
        const isTimeField = field.name === logsFrame?.timeField.name;

        field.config = {
          ...field.config,
          custom: {
            ...field.config.custom,
            inspect: !isTimeField, // Disable inspect for time field to avoid type errors
            filterable: true,
            width: isBodyField
              ? undefined
              : (columnWidthMap[field.name] ?? getInitialFieldWidth(field) ?? DEFAULT_COLUMN_WIDTH) +
                (isFirstField ? FIRST_COLUMN_WIDTH : 0), // Use stored width if available, otherwise use initial width
            cellOptions: isFirstField
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <>
                      <LogsTableActionButtons
                        {...cellProps}
                        fieldIndex={0}
                        logId={logsFrame?.idField?.values[cellProps.rowIndex]}
                        logsFrame={logsFrame ?? undefined}
                        exploreId={props.exploreId}
                        panelState={props.panelState}
                        displayedFields={props.displayedFields}
                        visualisationType={props.visualisationType}
                        absoluteRange={props.absoluteRange}
                        logRows={props.logRows}
                      />
                      <span className={styles.firstColumnCell}>
                        {cellProps.field.display?.(cellProps.value).text ?? String(cellProps.value)}
                      </span>
                    </>
                  ),
                }
              : field.config.custom?.cellOptions,
            headerComponent: isFirstField
              ? (headerProps: { defaultContent: React.ReactNode }) => (
                  <div className={styles.firstColumnHeader}>{headerProps.defaultContent}</div>
                )
              : field.config.custom?.headerComponent,
          },
          // This sets the individual field value as filterable
          filterable: isFieldFilterable(field, logsFrame?.bodyField.name ?? '', logsFrame?.timeField.name ?? ''),
        };

        // If it's a string, then try to guess for a better type for numeric support in viz
        field.type = field.type === FieldType.string ? (guessFieldTypeForField(field) ?? FieldType.string) : field.type;
      }

      return frameWithOverrides;
    },
    [
      logsSortOrder,
      timeZone,
      splitOpen,
      range,
      timeIndex,
      logsFrame,
      props.exploreId,
      props.panelState,
      props.displayedFields,
      props.visualisationType,
      props.absoluteRange,
      props.logRows,
      styles.firstColumnHeader,
      styles.firstColumnCell,
      columnWidthMap,
    ]
  );

  useEffect(() => {
    const prepare = async () => {
      if (!logsFrame?.timeField.name || !logsFrame?.bodyField.name) {
        setTableFrame(undefined);
        return;
      }

      // create extract JSON transformation for every field that is `json.RawMessage`
      const transformations: Array<DataTransformerConfig | CustomTransformOperator> = getLogsExtractFields(dataFrame);

      let labelFilters = buildLabelFilters(columnsWithMeta);

      // Add the label filters to the transformations
      const transform = getLabelFiltersTransform(labelFilters);
      if (transform) {
        transformations.push(transform);
      } else {
        // If no fields are filtered, filter the default fields, so we don't render all columns
        transformations.push({
          id: 'organize',
          options: {
            indexByName: {
              [logsFrame.bodyField.name]: 0,
              [logsFrame.timeField.name]: 1,
            },
            includeByName: {
              [logsFrame.bodyField.name]: true,
              [logsFrame.timeField.name]: true,
            },
          },
        });
      }

      if (transformations.length > 0) {
        const transformedDataFrame = await lastValueFrom(transformDataFrame(transformations, [dataFrame]));
        const tableFrame = prepareTableFrame(transformedDataFrame[0]);
        setTableFrame(tableFrame);
      } else {
        setTableFrame(prepareTableFrame(dataFrame));
      }
    };
    prepare();
  }, [
    columnsWithMeta,
    dataFrame,
    logsSortOrder,
    prepareTableFrame,
    logsFrame?.bodyField.name,
    logsFrame?.timeField.name,
  ]);

  if (!tableFrame) {
    return null;
  }

  const onCellFilterAdded = (filter: AdHocFilterItem) => {
    const { value, key, operator } = filter;
    const { onClickFilterLabel, onClickFilterOutLabel } = props;
    if (!onClickFilterLabel || !onClickFilterOutLabel) {
      return;
    }
    if (operator === FILTER_FOR_OPERATOR) {
      onClickFilterLabel(key, value, dataFrame);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      onClickFilterOutLabel(key, value, dataFrame);
    }
  };

  return (
    <Table
      data={tableFrame}
      width={width}
      onColumnResize={onColumnResize}
      onCellFilterAdded={props.onClickFilterLabel && props.onClickFilterOutLabel ? onCellFilterAdded : undefined}
      height={props.height}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
      initialSortBy={
        props.sortBy ?? [
          { displayName: logsFrame?.timeField.name || '', desc: logsSortOrder === LogsSortOrder.Descending },
        ]
      }
      onSortByChange={props.onSortByChange}
      initialRowIndex={initialRowIndex}
    />
  );
}

const isFieldFilterable = (field: Field, bodyName: string, timeName: string) => {
  if (!bodyName || !timeName) {
    return false;
  }
  if (bodyName === field.name) {
    return false;
  }
  if (timeName === field.name) {
    return false;
  }
  if (field.config.links?.length) {
    return false;
  }

  return true;
};

// TODO: explore if `logsFrame.ts` can help us with getting the right fields
// TODO Why is typeInfo not defined on the Field interface?
export function getLogsExtractFields(dataFrame: DataFrame) {
  return dataFrame.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}

function buildLabelFilters(columnsWithMeta: Record<string, FieldNameMeta>) {
  // Create object of label filters to include columns selected by the user
  let labelFilters: Record<string, number> = {};
  Object.keys(columnsWithMeta)
    .filter((key) => columnsWithMeta[key].active)
    .forEach((key) => {
      const index = columnsWithMeta[key].index;
      // Index should always be defined for any active column
      if (index !== undefined) {
        labelFilters[key] = index;
      }
    });

  return labelFilters;
}

function getLabelFiltersTransform(labelFilters: Record<string, number>) {
  let labelFiltersInclude: Record<string, boolean> = {};

  for (const key in labelFilters) {
    labelFiltersInclude[key] = true;
  }

  if (Object.keys(labelFilters).length > 0) {
    return {
      id: 'organize',
      options: {
        indexByName: labelFilters,
        includeByName: labelFiltersInclude,
      },
    };
  }
  return null;
}

function getInitialFieldWidth(field: Field): number | undefined {
  if (field.type === FieldType.time || field.name === DETECTED_LEVEL || field.name === LEVEL) {
    return DEFAULT_COLUMN_WIDTH;
  }

  return undefined;
}
