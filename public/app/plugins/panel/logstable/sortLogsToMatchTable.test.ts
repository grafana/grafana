import { FieldType, toDataFrame } from '@grafana/data';
import { createLogLine } from 'app/features/logs/components/mocks/logRow';

import { sortLogsToMatchTable } from './sortLogsToMatchTable';

describe('sortLogsToMatchTable', () => {
  const older = createLogLine({ uid: 'older', rowIndex: 0, timeEpochMs: 1000, labels: { env: 'prod' } });
  const newer = createLogLine({ uid: 'newer', rowIndex: 1, timeEpochMs: 2000, labels: { env: 'dev' } });
  const logs = [older, newer];

  test('preserves query order when the table is not sorted', () => {
    expect(sortLogsToMatchTable(logs).map((log) => log.uid)).toEqual(['older', 'newer']);
    expect(sortLogsToMatchTable(logs, []).map((log) => log.uid)).toEqual(['older', 'newer']);
  });

  test('sorts by timestamp descending', () => {
    expect(sortLogsToMatchTable(logs, [{ displayName: 'Time', desc: true }]).map((log) => log.uid)).toEqual([
      'newer',
      'older',
    ]);
  });

  test('sorts by timestamp ascending', () => {
    expect(sortLogsToMatchTable(logs, [{ displayName: 'Time', desc: false }]).map((log) => log.uid)).toEqual([
      'older',
      'newer',
    ]);
  });

  test('sorts by a label column', () => {
    expect(sortLogsToMatchTable(logs, [{ displayName: 'env', desc: false }]).map((log) => log.uid)).toEqual([
      'newer',
      'older',
    ]);
  });

  test('sorts by a non-time field on the data frame', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Line', type: FieldType.string, values: ['beta', 'alpha'] },
      ],
    });
    const first = createLogLine({ uid: 'first', rowIndex: 0, timeEpochMs: 1000, dataFrame: frame });
    const second = createLogLine({ uid: 'second', rowIndex: 1, timeEpochMs: 2000, dataFrame: frame });

    expect(sortLogsToMatchTable([first, second], [{ displayName: 'Line', desc: false }]).map((log) => log.uid)).toEqual([
      'second',
      'first',
    ]);
  });

  test('does not mutate the input array', () => {
    const result = sortLogsToMatchTable(logs, [{ displayName: 'Time', desc: true }]);

    expect(result).not.toBe(logs);
    expect(logs.map((log) => log.uid)).toEqual(['older', 'newer']);
  });
});
