import { MutableDataFrame, LogLevel, LogRowModel } from '@grafana/data';
export const makeLogs = (numberOfLogsToCreate: number, overrides?: Partial<LogRowModel>): LogRowModel[] => {
  const array = [];

  for (let i = 0; i < numberOfLogsToCreate; i++) {
    const uuid = (i + 1).toString();
    const entry = `log message ${uuid}`;
    const timeInMs = overrides?.timeEpochMs || new Date().getTime();

    array.push({
      uid: uuid,
      entryFieldIndex: 0,
      rowIndex: 0,
      dataFrame: new MutableDataFrame(),
      logLevel: LogLevel.debug,
      entry,
      hasAnsi: false,
      hasUnescapedContent: false,
      labels: {},
      raw: entry,
      timeFromNow: '',
      timeEpochMs: timeInMs - i,
      timeEpochNs: (timeInMs * 1000000 - i).toString(),
      timeLocal: '',
      timeUtc: '',
      ...overrides,
    });
  }

  return array.sort((a, b) => b.timeEpochMs - a.timeEpochMs);
};
