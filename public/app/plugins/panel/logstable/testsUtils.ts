import { DataFrameType, FieldType, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      {
        name: LOGS_DATAPLANE_BODY_NAME,
        type: FieldType.string,
        values: ['log 1', 'log 2'], // Add display function
        display: (value: unknown) => ({
          text: String(value),
          numeric: 0,
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { service: 'frontend', level: 'info' },
          { service: 'backend', level: 'error' },
        ],
      },
    ],
  }),
];

const panelData: PanelData = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: testLogsDataFrame,
};

export const getPanelData = (data?: Partial<PanelData>): PanelData => {
  return { ...panelData, ...data };
};
