import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  parseLogsFrame,
  type LogsFrame,
} from 'app/features/logs/logsFrame';

import { logsFrameHasErrorAttributes } from './LogsTableRowActionButtons';

function parseFrame(fields: Array<{ name: string; type: FieldType; values: unknown[] }>): LogsFrame {
  const logsFrame = parseLogsFrame(
    toDataFrame({
      meta: { type: DataFrameType.LogLines },
      fields,
    })
  );
  if (!logsFrame) {
    throw new Error('Failed to parse logs frame');
  }
  return logsFrame;
}

const timestamp = { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2, 3, 4] };
const body = { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['a', 'b', 'c', 'd'] };

describe('logsFrameHasErrorAttributes', () => {
  it('reads labels once when no row has error attributes', () => {
    const logsFrame = parseFrame([
      timestamp,
      body,
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { app: 'api', level: 'info' },
          { app: 'api', level: 'info' },
          { app: 'api', level: 'info' },
          { app: 'api', level: 'info' },
        ],
      },
    ]);
    const labels = jest.spyOn(logsFrame, 'getLogFrameLabels');
    const labelsAsLabels = jest.spyOn(logsFrame, 'getLogFrameLabelsAsLabels');

    expect(logsFrameHasErrorAttributes(logsFrame)).toBe(false);
    expect(labels).toHaveBeenCalledTimes(1);
    expect(labelsAsLabels).not.toHaveBeenCalled();

    expect(logsFrameHasErrorAttributes(logsFrame)).toBe(false);
    expect(labels).toHaveBeenCalledTimes(1);
  });

  it('finds a non-string error attribute on the last row after reading labels once', () => {
    const logsFrame = parseFrame([
      timestamp,
      body,
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { app: 'api' },
          { app: 'api' },
          { app: 'api' },
          { app: 'api', 'exception.stacktrace': { frames: ['at main'] } },
        ],
      },
    ]);
    const labels = jest.spyOn(logsFrame, 'getLogFrameLabels');
    const labelsAsLabels = jest.spyOn(logsFrame, 'getLogFrameLabelsAsLabels');

    expect(logsFrameHasErrorAttributes(logsFrame)).toBe(true);
    expect(labels).toHaveBeenCalledTimes(1);
    expect(labelsAsLabels).not.toHaveBeenCalled();
  });

  it('ignores an empty error field and detects a populated one', () => {
    const empty = parseFrame([
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['a'] },
      { name: 'error.message', type: FieldType.string, values: [''] },
    ]);
    const populated = parseFrame([
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['a', 'b'] },
      { name: 'error.message', type: FieldType.string, values: [null, 'failed'] },
    ]);

    expect(logsFrameHasErrorAttributes(empty)).toBe(false);
    expect(logsFrameHasErrorAttributes(populated)).toBe(true);
  });
});
