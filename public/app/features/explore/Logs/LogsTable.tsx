import memoizeOne from 'memoize-one';
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

interface Props {
  logsFrames?: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
}

const getTableHeight = memoizeOne((dataFrames: DataFrame[] | undefined) => {
  const largestFrameLength = dataFrames?.reduce((length, frame) => {
    return frame.length > length ? frame.length : length;
  }, 0);
  // from TableContainer.tsx
  return Math.min(600, Math.max(largestFrameLength ?? 0 * 36, 300) + 40 + 46);
});

export const LogsTable: React.FunctionComponent<Props> = (props) => {
  const { timeZone, splitOpen, range, logsSortOrder, width, logsFrames } = props;

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
        .filter((field: Field) => {
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
      if (transformations.length > 0) {
        const [transformedDataFrame] = await lastValueFrom(transformDataFrame(transformations, [dataFrame]));
        setTableFrame(prepareTableFrame(transformedDataFrame));
      } else {
        setTableFrame(prepareTableFrame(dataFrame));
      }
    };
    prepare();
  }, [prepareTableFrame, logsFrames, logsSortOrder]);

  if (!tableFrame) {
    return null;
  }

  return (
    <Table
      data={tableFrame}
      width={width}
      height={getTableHeight(props.logsFrames)}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
    />
  );
};
