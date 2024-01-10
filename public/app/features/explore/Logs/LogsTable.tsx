import React, { useCallback, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  CustomTransformOperator,
  DataFrame,
  DataFrameType,
  DataTransformerConfig,
  Field,
  FieldType,
  LogsSortOrder,
  sortDataFrame,
  SplitOpen,
  TimeRange,
  transformDataFrame,
  ValueLinkConfig,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { AdHocFilterItem, Table } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import { LogsFrame, parseLogsFrame } from 'app/features/logs/logsFrame';

import { getFieldLinksForExplore } from '../utils/links';

import { fieldNameMeta } from './LogsTableWrap';

interface Props {
  dataFrame: DataFrame;
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  columnsWithMeta: Record<string, fieldNameMeta>;
  height: number;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
}

export function LogsTable(props: Props) {
  const { timeZone, splitOpen, range, logsSortOrder, width, dataFrame, columnsWithMeta } = props;
  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
      if (!frame.length) {
        return frame;
      }
      // Parse the dataframe to a logFrame
      const logsFrame = parseLogsFrame(frame);
      const timeIndex = logsFrame?.timeField.index;

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
      for (const field of frameWithOverrides.fields) {
        field.getLinks = (config: ValueLinkConfig) => {
          return getFieldLinksForExplore({
            field,
            rowIndex: config.valueRowIndex!,
            splitOpenFn: splitOpen,
            range: range,
            dataFrame: sortedFrame!,
          });
        };
        field.config = {
          ...field.config,
          custom: {
            inspect: true,
            filterable: true, // This sets the columns to be filterable
            ...field.config.custom,
          },
          // This sets the individual field value as filterable
          filterable: isFieldFilterable(field, logsFrame ?? undefined),
        };
      }

      return frameWithOverrides;
    },
    [logsSortOrder, timeZone, splitOpen, range]
  );

  useEffect(() => {
    const prepare = async () => {
      // Parse the dataframe to a logFrame
      const logsFrame = dataFrame ? parseLogsFrame(dataFrame) : undefined;

      if (!logsFrame) {
        setTableFrame(undefined);
        return;
      }

      // create extract JSON transformation for every field that is `json.RawMessage`
      const transformations: Array<DataTransformerConfig | CustomTransformOperator> = extractFields(dataFrame);

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
  }, [columnsWithMeta, dataFrame, logsSortOrder, prepareTableFrame]);

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
      onCellFilterAdded={props.onClickFilterLabel && props.onClickFilterOutLabel ? onCellFilterAdded : undefined}
      height={props.height}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
    />
  );
}

const isFieldFilterable = (field: Field, logsFrame?: LogsFrame | undefined) => {
  if (!logsFrame) {
    return false;
  }
  if (logsFrame.bodyField.name === field.name) {
    return false;
  }
  if (logsFrame.timeField.name === field.name) {
    return false;
  }
  if (field.config.links?.length) {
    return false;
  }

  return true;
};

// TODO: explore if `logsFrame.ts` can help us with getting the right fields
// TODO Why is typeInfo not defined on the Field interface?
function extractFields(dataFrame: DataFrame) {
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

function buildLabelFilters(columnsWithMeta: Record<string, fieldNameMeta>) {
  // Create object of label filters to include columns selected by the user
  let labelFilters: Record<string, true> = {};
  Object.keys(columnsWithMeta)
    .filter((key) => columnsWithMeta[key].active)
    .forEach((key) => {
      labelFilters[key] = true;
    });

  return labelFilters;
}

function getLabelFiltersTransform(labelFilters: Record<string, true>) {
  if (Object.keys(labelFilters).length > 0) {
    return {
      id: 'organize',
      options: {
        includeByName: labelFilters,
      },
    };
  }
  return null;
}
