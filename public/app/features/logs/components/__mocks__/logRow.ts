import { LogLevel, LogRowModel, MutableDataFrame } from '@grafana/data';

export const createLogRow = (overrides?: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides?.uid || '1';
  const timeEpochMs = overrides?.timeEpochMs || 1;
  const entry = overrides?.entry || `log message ${uid}`;

  return {
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: new MutableDataFrame(),
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
