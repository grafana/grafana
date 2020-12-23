import { formatDuration, formatFilter, formatRule, formatRules, formatThreshold } from './AlertRulesTable.utils';
import { rulesStubs } from '../__mocks__/alertRulesStubs';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

describe('AlertRulesTable utils', () => {
  test('formatFilter', () => {
    expect(formatFilter({ key: 'testKey', type: 'EQUAL', value: '1337' })).toEqual('testKey=1337');
  });

  test('formatThreshold', () => {
    expect(
      formatThreshold({
        params: [
          {
            name: 'threshold',
            value: 70,
            unit: '%',
          },
        ],
      })
    ).toEqual('70 %');

    expect(
      formatThreshold({
        params: [
          {
            name: 'threshold',
            value: true,
          },
        ],
      })
    ).toEqual('true');
  });

  test('formatDuration', () => {
    expect(formatDuration('19s')).toEqual('19 seconds');
    expect(formatDuration('59s')).toEqual('59 seconds');
    expect(formatDuration('60s')).toEqual('a minute');
    expect(formatDuration('120s')).toEqual('2 minutes');
    expect(formatDuration('3600s')).toEqual('an hour');
    expect(formatDuration('7200s')).toEqual('2 hours');
  });

  test('formatRule', () => {
    expect(formatRule(rulesStubs[0])).toEqual({
      createdAt: '2020-11-25 16:53:39.366',
      disabled: false,
      duration: '2 minutes',
      filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
      severity: 'Critical',
      summary: 'Database down - HR - Prod',
      threshold: 'true',
      lastNotified: '2020-11-25 16:53:39.366',
    });

    expect(formatRule(rulesStubs[3])).toEqual({
      createdAt: '2020-11-25 16:53:39.366',
      disabled: true,
      duration: '5 minutes',
      filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
      severity: 'Warning',
      summary: 'High network throughput in - Mnfcg - Dev',
      threshold: '100 GB/min',
      lastNotified: '',
    });
  });

  test('formatRules', () => {
    expect(formatRules([])).toEqual([]);

    expect(formatRules([rulesStubs[0], rulesStubs[3]])).toEqual([
      {
        createdAt: '2020-11-25 16:53:39.366',
        disabled: false,
        duration: '2 minutes',
        filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
        severity: 'Critical',
        summary: 'Database down - HR - Prod',
        threshold: 'true',
        lastNotified: '2020-11-25 16:53:39.366',
      },
      {
        createdAt: '2020-11-25 16:53:39.366',
        disabled: true,
        duration: '5 minutes',
        filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
        severity: 'Warning',
        summary: 'High network throughput in - Mnfcg - Dev',
        threshold: '100 GB/min',
        lastNotified: '',
      },
    ]);
  });
});
