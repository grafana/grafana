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
import { Table } from '@grafana/ui';
import { separateVisibleFields } from 'app/features/logs/components/logParser';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

import { getFieldLinksForExplore } from '../utils/links';

import { fieldNameMeta } from './LogsTableWrap';

interface Props {
  logsFrames?: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  labelCardinalityState: Record<string, fieldNameMeta>;
  height: number;
}

export const LogsTable: React.FunctionComponent<Props> = (props) => {
  const { timeZone, splitOpen, range, logsSortOrder, width, logsFrames, labelCardinalityState } = props;

  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
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
            filterable: true,
            inspect: true,
            ...field.config.custom,
          },
        };
      }

      return frameWithOverrides;
    },
    [logsSortOrder, range, splitOpen, timeZone]
  );

  useEffect(() => {
    const prepare = async () => {
      if (!logsFrames || !logsFrames.length) {
        setTableFrame(undefined);
        return;
      }

      // TODO: This does not work with multiple logs queries for now, as we currently only support one logs frame.
      let dataFrame = logsFrames[0];

      const logsFrame = parseLogsFrame(dataFrame);
      const timeIndex = logsFrame?.timeField.index;
      dataFrame = sortDataFrame(dataFrame, timeIndex, logsSortOrder === LogsSortOrder.Descending);

      // create extract JSON transformation for every field that is `json.RawMessage`
      // TODO: explore if `logsFrame.ts` can help us with getting the right fields
      const transformations = dataFrame.fields
        .filter((field: Field & { typeInfo?: { frame: string } }) => {
          return field.typeInfo?.frame === 'json.RawMessage';
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

      // remove fields that should not be displayed
      const hiddenFields = separateVisibleFields(dataFrame, { keepBody: true, keepTimestamp: true }).hidden;
      hiddenFields.forEach((field: Field, index: number) => {
        transformations.push({
          id: 'organize',
          options: {
            excludeByName: {
              [field.name]: true,
            },
          },
        });
      });

      // Every field that isn't active is visible
      let labelFilters: Record<string, true> = {};
      Object.keys(labelCardinalityState)
        .filter((key) => !labelCardinalityState[key].active)
        .forEach((key) => {
          labelFilters[key] = true;
        });

      // Add one transform to remove the fields that are not currently selected
      if (Object.keys(labelFilters).length > 0) {
        transformations.push({
          id: 'organize',
          options: {
            excludeByName: labelFilters,
          },
        });
      }

      if (transformations.length > 0) {
        const [transformedDataFrame] = await lastValueFrom(transformDataFrame(transformations, [dataFrame]));
        const tableFrame = prepareTableFrame(transformedDataFrame);
        setTableFrame(tableFrame);
      } else {
        setTableFrame(prepareTableFrame(dataFrame));
      }
    };
    prepare();
  }, [prepareTableFrame, logsFrames, logsSortOrder, labelCardinalityState]);

  if (!tableFrame) {
    return null;
  }

  return (
    <Table
      data={tableFrame}
      width={width}
      height={props.height}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
    />
  );
};
