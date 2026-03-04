import { FieldType } from '@grafana/data';

import {
  isNotificationOutcome,
  isNotificationStatus,
  matcherToAPIFormat,
  notificationsToDataFrame,
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

describe('notificationsToDataFrame', () => {
  it('should return empty DataFrame when no entries', () => {
    const result = notificationsToDataFrame({ entries: [] });

    expect(result.length).toBe(0);
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].name).toBe('time');
    expect(result.fields[0].type).toBe(FieldType.time);
    expect(result.fields[0].values).toEqual([]);
    expect(result.fields[1].name).toBe('value');
    expect(result.fields[1].type).toBe(FieldType.number);
    expect(result.fields[1].values).toEqual([]);
  });

  it('should group entries by 10-second intervals', () => {
    const entries = [
      makeEntry('2025-01-01T00:00:01Z'), // interval 0
      makeEntry('2025-01-01T00:00:05Z'), // interval 0 (same 10s bucket)
      makeEntry('2025-01-01T00:00:15Z'), // interval 10000
      makeEntry('2025-01-01T00:00:35Z'), // interval 30000
      makeEntry('2025-01-01T00:00:37Z'), // interval 30000 (same 10s bucket)
    ];

    const result = notificationsToDataFrame({ entries });

    expect(result.fields[0].name).toBe('time');
    expect(result.fields[1].name).toBe('value');

    // Should have 3 time buckets
    expect(result.length).toBe(3);

    // Bucket at 0s: 2 entries
    const bucket0 = Math.floor(new Date('2025-01-01T00:00:01Z').getTime() / 10000) * 10000;
    const bucket10 = Math.floor(new Date('2025-01-01T00:00:15Z').getTime() / 10000) * 10000;
    const bucket30 = Math.floor(new Date('2025-01-01T00:00:35Z').getTime() / 10000) * 10000;

    expect(result.fields[0].values).toEqual([bucket0, bucket10, bucket30]);
    expect(result.fields[1].values).toEqual([2, 1, 2]);
  });

  it('should handle a single entry', () => {
    const entries = [makeEntry('2025-01-01T12:00:00Z')];

    const result = notificationsToDataFrame({ entries });

    expect(result.length).toBe(1);
    expect(result.fields[1].values).toEqual([1]);
  });

  it('should handle undefined entries gracefully', () => {
    const result = notificationsToDataFrame({ entries: undefined as unknown as [] });

    expect(result.length).toBe(0);
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].values).toEqual([]);
    expect(result.fields[1].values).toEqual([]);
  });

  it('should produce one bucket per entry when timestamps are in different intervals', () => {
    const entries = [
      makeEntry('2025-01-01T00:01:00Z'),
      makeEntry('2025-01-01T00:00:05Z'),
      makeEntry('2025-01-01T00:00:30Z'),
    ];

    const result = notificationsToDataFrame({ entries });

    // 3 entries in 3 different 10s buckets → 3 buckets each with count 1
    expect(result.length).toBe(3);
    expect(result.fields[1].values).toEqual([1, 1, 1]);

    // Buckets follow insertion order (order entries appear)
    const bucket60 = Math.floor(new Date('2025-01-01T00:01:00Z').getTime() / 10000) * 10000;
    const bucket0 = Math.floor(new Date('2025-01-01T00:00:05Z').getTime() / 10000) * 10000;
    const bucket30 = Math.floor(new Date('2025-01-01T00:00:30Z').getTime() / 10000) * 10000;
    expect(result.fields[0].values).toEqual([bucket60, bucket0, bucket30]);
  });
});

function makeEntry(timestamp: string) {
  return {
    timestamp,
    uuid: 'test-uuid',
    receiver: 'slack',
    integration: 'slack',
    integrationIndex: 0,
    status: 'firing' as const,
    outcome: 'success' as const,
    groupLabels: { alertname: 'test' },
    ruleUIDs: [],
    alertCount: 1,
    alerts: [],
    retry: false,
    duration: 100,
    pipelineTime: timestamp,
    groupKey: 'test-group',
  };
}
