import { css } from '@emotion/css';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  urlUtil,
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
  ValueLinkConfig,
  ExploreLogsPanelState,
  AbsoluteTimeRange,
  LogRowModel,
  GrafanaTheme2,
} from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { AdHocFilterItem, CustomCellRendererProps, Table, TableCellDisplayMode, useStyles2 } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { LogsFrame } from 'app/features/logs/logsFrame';

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
  displayedFields?: string[];
  exploreId?: string;
  visualisationType?: 'table' | 'logs';
  panelState?: ExploreLogsPanelState;
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
}

export function LogsTable(props: Props) {
  const { timeZone, splitOpen, range, logsSortOrder, width, dataFrame, columnsWithMeta, logsFrame } = props;
  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);
  const [columnWidthMap, setColumnWidthMap] = useState<Record<string, number>>({});
  const timeIndex = logsFrame?.timeField.index;
  const styles = useStyles2(getStyles);

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

  // Set the initial row index based on the selected log ID if selectedLine is present in the URL
  const initialRowIndex = useMemo(() => {
    if (!selectedLogInfo || !tableFrame || !selectedLogInfo.id) {
      return undefined;
    }

    // Search through all fields in tableFrame to find the one containing the ID
    for (const field of tableFrame.fields) {
      const lineIndex = field.values.findIndex((v: unknown) => v === selectedLogInfo.id);
      if (lineIndex !== -1) {
        return lineIndex;
      }
    }

    return undefined;
  }, [selectedLogInfo, tableFrame]);

  // Clear the selectedLine URL parameter after table loads
  useEffect(() => {
    if (initialRowIndex !== undefined && tableFrame) {
      // Remove selectedLine from URL using locationService (proper Grafana way)
      locationService.partial({ selectedLine: undefined }, true);
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
        // Hide ID field from visualization (it's only needed for row matching)
        if (logsFrame?.idField && (field.name === logsFrame.idField.name || field.name === 'id')) {
          field.config = {
            ...field.config,
            custom: {
              ...field.config.custom,
              hideFrom: {
                ...field.config.custom?.hideFrom,
                viz: true,
              },
            },
          };
        }

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

        field.config = {
          ...field.config,
          custom: {
            inspect: true,
            filterable: true, // This sets the columns to be filterable
            width: columnWidthMap[field.name] ?? getInitialFieldWidth(field),
            ...field.config.custom,
            cellOptions: isFirstField
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <>
                      <LogsTableActionButtons
                        {...cellProps}
                        logsFrame={logsFrame ?? undefined}
                        displayedFields={props.displayedFields}
                        exploreId={props.exploreId}
                        panelState={props.panelState}
                        visualisationType={props.visualisationType}
                        absoluteRange={props.absoluteRange}
                        logRows={props.logRows}
                        rowIndex={cellProps.rowIndex}
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
      columnWidthMap,
      logsFrame,
      timeIndex,
      styles.firstColumnCell,
      styles.firstColumnHeader,
      props.displayedFields,
      props.exploreId,
      props.panelState,
      props.visualisationType,
      props.absoluteRange,
      props.logRows,
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
        // Ensure ID field is always included for row matching
        if (logsFrame?.idField?.name) {
          transform.options.includeByName = {
            ...transform.options.includeByName,
            [logsFrame.idField.name]: true,
          };
        }
        transformations.push(transform);
      } else {
        // If no fields are filtered, filter the default fields, so we don't render all columns
        // Always include ID field for row matching
        const includeByName: Record<string, boolean> = {
          [logsFrame.bodyField.name]: true,
          [logsFrame.timeField.name]: true,
        };
        if (logsFrame?.idField?.name) {
          includeByName[logsFrame.idField.name] = true;
        }
        transformations.push({
          id: 'organize',
          options: {
            indexByName: {
              [logsFrame.bodyField.name]: 0,
              [logsFrame.timeField.name]: 1,
            },
            includeByName,
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
    logsFrame?.idField?.name,
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
      initialSortBy={[
        { displayName: logsFrame?.timeField.name || '', desc: logsSortOrder === LogsSortOrder.Descending },
      ]}
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
  if (field.type === FieldType.time) {
    return 230;
  }
  return undefined;
}

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
