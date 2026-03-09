import { FieldType } from '@grafana/data';

import {
  isNotificationOutcome,
  isNotificationStatus,
  matcherToAPIFormat,
  rangeCountsToDataFrame,
} from './NotificationsRuntimeDataSource';

describe('isNotificationStatus', () => {
  it('should return true for valid statuses', () => {
    expect(isNotificationStatus('firing')).toBe(true);
    expect(isNotificationStatus('resolved')).toBe(true);
  });

  it('should return false for invalid statuses', () => {
    expect(isNotificationStatus('all')).toBe(false);
    expect(isNotificationStatus('')).toBe(false);
    expect(isNotificationStatus('unknown')).toBe(false);
    expect(isNotificationStatus('FIRING')).toBe(false);
  });
});

describe('isNotificationOutcome', () => {
  it('should return true for valid outcomes', () => {
    expect(isNotificationOutcome('success')).toBe(true);
    expect(isNotificationOutcome('error')).toBe(true);
  });

  it('should return false for invalid outcomes', () => {
    expect(isNotificationOutcome('all')).toBe(false);
    expect(isNotificationOutcome('')).toBe(false);
    expect(isNotificationOutcome('failed')).toBe(false);
    expect(isNotificationOutcome('SUCCESS')).toBe(false);
  });
});

describe('matcherToAPIFormat', () => {
  it('should convert equal matcher', () => {
    const result = matcherToAPIFormat({ name: 'severity', value: 'critical', isEqual: true, isRegex: false });
    expect(result).toEqual({ type: '=', label: 'severity', value: 'critical' });
  });

  it('should convert not-equal matcher', () => {
    const result = matcherToAPIFormat({ name: 'severity', value: 'info', isEqual: false, isRegex: false });
    expect(result).toEqual({ type: '!=', label: 'severity', value: 'info' });
  });

  it('should convert regex-equal matcher', () => {
    const result = matcherToAPIFormat({ name: 'instance', value: 'cluster-us-.+', isEqual: true, isRegex: true });
    expect(result).toEqual({ type: '=~', label: 'instance', value: 'cluster-us-.+' });
  });

  it('should convert not-regex matcher', () => {
    const result = matcherToAPIFormat({ name: 'job', value: 'test.*', isEqual: false, isRegex: true });
    expect(result).toEqual({ type: '!~', label: 'job', value: 'test.*' });
  });
});

describe('rangeCountsToDataFrame', () => {
  it('should return empty DataFrame when no range counts', () => {
    const result = rangeCountsToDataFrame([]);

    expect(result.length).toBe(0);
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].name).toBe('time');
    expect(result.fields[0].type).toBe(FieldType.time);
    expect(result.fields[0].values).toEqual([]);
    expect(result.fields[1].name).toBe('value');
    expect(result.fields[1].type).toBe(FieldType.number);
    expect(result.fields[1].values).toEqual([]);
  });

  it('should convert range count timestamps from seconds to milliseconds', () => {
    const rangeCounts = [
      {
        count: 0,
        values: [
          { timestamp: 1735689600, count: 5 }, // 2025-01-01T00:00:00Z in seconds
          { timestamp: 1735689660, count: 3 }, // +60s
          { timestamp: 1735689720, count: 8 }, // +120s
        ],
      },
    ];

    const result = rangeCountsToDataFrame(rangeCounts);

    expect(result.length).toBe(3);
    expect(result.fields[0].values).toEqual([1735689600 * 1000, 1735689660 * 1000, 1735689720 * 1000]);
    expect(result.fields[1].values).toEqual([5, 3, 8]);
  });

  it('should use the first series when multiple range counts are returned', () => {
    const rangeCounts = [
      { count: 0, values: [{ timestamp: 1000, count: 10 }] },
      { count: 0, values: [{ timestamp: 2000, count: 20 }] },
    ];

    const result = rangeCountsToDataFrame(rangeCounts);

    expect(result.length).toBe(1);
    expect(result.fields[0].values).toEqual([1000 * 1000]);
    expect(result.fields[1].values).toEqual([10]);
  });

  it('should handle a range count series with no values', () => {
    const rangeCounts = [{ count: 0, values: [] }];

    const result = rangeCountsToDataFrame(rangeCounts);

    expect(result.length).toBe(0);
    expect(result.fields[0].values).toEqual([]);
    expect(result.fields[1].values).toEqual([]);
  });
});
