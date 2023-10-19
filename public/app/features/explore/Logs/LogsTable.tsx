import React, { useCallback, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  Field,
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
import { separateVisibleFields } from 'app/features/logs/components/logParser';
import { LogsFrame, parseLogsFrame } from 'app/features/logs/logsFrame';

import { getFieldLinksForExplore } from '../utils/links';

import { fieldNameMeta } from './LogsTableWrap';

interface Props {
  logsFrames?: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  columnsWithMeta: Record<string, fieldNameMeta>;
  height: number;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  datasourceType?: string;
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
  // @todo not currently excluding derived fields from filtering

  return true;
};

export const LogsTable: React.FunctionComponent<Props> = (props) => {
  const { timeZone, splitOpen, range, logsSortOrder, width, logsFrames, columnsWithMeta } = props;
  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);

  // Only a single frame (query) is supported currently
  const logFrameRaw = logsFrames ? logsFrames[0] : undefined;

  // Parse the dataframe to a logFrame
  const logsFrame = logFrameRaw ? parseLogsFrame(logFrameRaw) : undefined;

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
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
    // We dont want to re-render whenever the splitOpen function changes, so it's being purposefully excluded from the deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logsSortOrder, timeZone, props.datasourceType, range]
  );

  /**
   * Known issue here is that there is a re-render of the table when the set of labels has changed,
   * the transformations are added after the fresh data has already been rendered
   */
  useEffect(() => {
    const prepare = async () => {
      if (!logFrameRaw || !logsFrame) {
        setTableFrame(undefined);
        return;
      }

      // Tables currently only support one frame
      let dataFrame = logFrameRaw;

      const timeIndex = logsFrame?.timeField.index;
      dataFrame = sortDataFrame(dataFrame, timeIndex, logsSortOrder === LogsSortOrder.Descending);

      // create extract JSON transformation for every field that is `json.RawMessage`
      // TODO: explore if `logsFrame.ts` can help us with getting the right fields
      const transformations = dataFrame.fields
        .filter((field: Field & { typeInfo?: { frame: string } }) => {
          return field.typeInfo?.frame === 'json.RawMessage' && props.datasourceType === 'loki';
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
            // hide the field that was extracted
            {
              id: 'organize',
              options: {
                excludeByName: {
                  [field.name]: true,
                },
              },
            },
          ];
        });

      // remove hidden fields
      const hiddenFields = separateVisibleFields(dataFrame, { keepBody: true, keepTimestamp: true }).hidden;
      hiddenFields.forEach((field: Field) => {
        transformations.push({
          id: 'organize',
          options: {
            excludeByName: {
              [field.name]: true,
            },
          },
        });
      });

      // Create object of label filters to filter out any columns not selected by the user
      let labelFilters: Record<string, true> = {};
      Object.keys(columnsWithMeta)
        .filter((key) => !columnsWithMeta[key].active)
        .forEach((key) => {
          labelFilters[key] = true;
        });

      // We could be getting fresh data
      const uniqueLabels = new Set<string>();
      const logFrameLabels = logsFrame?.getAttributesAsLabels();

      // Populate the set with all labels from latest dataframe
      logFrameLabels?.forEach((labels) => {
        Object.keys(labels).forEach((label) => {
          uniqueLabels.add(label);
        });
      });

      const stuffWeAdded: string[] = [];

      // Check if there are labels in the data, that aren't yet in the labelFilters, and set them to be hidden by the transform
      Object.keys(labelFilters).forEach((label) => {
        if (!uniqueLabels.has(label)) {
          labelFilters[label] = true;
          stuffWeAdded.push(label);
        }
      });

      // Check if there are labels in the label filters that aren't yet in the data, and set those to also be hidden
      // The next time the column filters are synced any extras will be removed
      Array.from(uniqueLabels).forEach((label) => {
        if (label in columnsWithMeta && !columnsWithMeta[label]?.active) {
          labelFilters[label] = true;
          stuffWeAdded.push(label);
        } else if (!labelFilters[label] && !(label in columnsWithMeta)) {
          labelFilters[label] = true;
        }
      });

      // Add one transform to remove everything we added above
      if (Object.keys(labelFilters).length > 0) {
        transformations.push({
          id: 'organize',
          options: {
            excludeByName: labelFilters,
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

    // This is messy: this is triggered either by user action of adding/removing columns, or from the dataframe (query result) changing
    // We have to be careful and make sure not to assume that the columnsWithMeta is "recent", it is also updated when the dataframe changes, but it doesn't always happen first!
    // Also if you add both the logFrame and the logFrameRaw as dependencies it will cause an infinite re-render: adding the eslint ignore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsWithMeta, logFrameRaw, logsSortOrder, props.datasourceType, prepareTableFrame]);

  if (!tableFrame) {
    return null;
  }

  const onCellFilterAdded = (filter: AdHocFilterItem) => {
    if (!props.onClickFilterLabel || !props.onClickFilterOutLabel) {
      return;
    }
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      props.onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      props.onClickFilterOutLabel(key, value);
    }
  };

  return (
    <Table
      data={tableFrame}
      width={width}
      onCellFilterAdded={onCellFilterAdded}
      height={props.height}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
    />
  );
};
