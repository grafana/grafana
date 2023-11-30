import { FieldType, LogLevel, LogRowModel, toDataFrame } from '@grafana/data';

export const createLogRow = (overrides?: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides?.uid || '1';
  const timeEpochMs = overrides?.timeEpochMs || 1;
  const entry = overrides?.entry || `log message ${uid}`;

  return {
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: toDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 1] },
        {
          name: 'Line',
          type: FieldType.string,
          values: ['line1', 'line2'],
        },
        { name: 'labels', type: FieldType.other, values: [{ app: 'app01' }, { app: 'app02' }] },
      ],
    }),
    uid,
    logLevel: LogLevel.info,
    entry,
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    raw: entry,
    timeFromNow: '',
    timeEpochMs,
    timeEpochNs: (timeEpochMs * 1000000).toString(),
    timeLocal: '',
    timeUtc: '',
    searchWords: [],
    ...overrides,
  };
};
