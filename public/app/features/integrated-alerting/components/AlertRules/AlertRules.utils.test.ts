import { formatDuration, formatFilter, formatRule, formatRules, formatThreshold } from './AlertRules.utils';
import { rulesStubs } from './__mocks__/alertRulesStubs';
import { AlertRulesListPayloadTemplate } from './AlertRules.types';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

const testTemplate1: AlertRulesListPayloadTemplate = {
  name: 'test1',
  summary: 'Test1',
  params: [
    {
      name: 'threshold',
      float: {
        default: 70,
      },
      unit: 'PERCENTAGE',
      type: 'FLOAT',
    },
  ],
};

const testTemplate2: AlertRulesListPayloadTemplate = {
  name: 'test2',
  summary: 'Test2',
  params: [],
};

const testTemplate3: AlertRulesListPayloadTemplate = {
  name: 'test3',
  summary: 'Test3',
  params: [
    {
      name: 'threshold',
      bool: {
        default: true,
      },
      type: 'BOOL',
    },
  ],
};

describe('AlertRulesTable utils', () => {
  test('formatFilter', () => {
    expect(formatFilter({ key: 'testKey', type: 'EQUAL', value: '1337' })).toEqual('testKey=1337');
  });

  test('formatThreshold', () => {
    expect(formatThreshold(testTemplate1, undefined)).toEqual('70 %');

    expect(formatThreshold(testTemplate1, [])).toEqual('70 %');

    expect(formatThreshold(testTemplate2, undefined)).toEqual('');

    expect(formatThreshold(testTemplate2, [])).toEqual('');

    expect(
      formatThreshold(testTemplate2, [
        {
          name: 'threshold',
          float: 70,
          type: 'FLOAT',
        },
      ])
    ).toEqual('');

    expect(
      formatThreshold(testTemplate1, [
        {
          name: 'threshold',
          float: 70,
          type: 'FLOAT',
        },
      ])
    ).toEqual('70 %');

    expect(
      formatThreshold(testTemplate3, [
        {
          name: 'threshold',
          type: 'BOOL',
          bool: true,
        },
      ])
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
      rawValues: {
        rule_id: 'test 1',
        channels: [],
        created_at: '2020-11-25T16:53:39.366Z',
        disabled: false,
        filters: [
          {
            key: 'environment',
            type: 'EQUAL',
            value: 'prod',
          },
          {
            key: 'app',
            type: 'EQUAL',
            value: 'wordpress',
          },
          {
            key: 'cluster',
            type: 'EQUAL',
            value: 'PXCCluster1',
          },
        ],
        for: '120s',
        last_notified: '2020-11-25T16:53:39.366Z',
        params: [
          {
            bool: true,
            name: 'threshold',
            type: 'BOOL',
          },
        ],
        severity: 'SEVERITY_CRITICAL',
        summary: 'Database down - HR - Prod',
        template: {
          name: 'test 1',
          params: [
            {
              bool: {
                default: true,
              },
              name: 'threshold',
              type: 'BOOL',
            },
          ],
          summary: 'Test 1',
        },
      },
      ruleId: 'test 1',
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
      rawValues: {
        rule_id: 'test 4',
        channels: [],
        created_at: '2020-11-25T16:53:39.366Z',
        disabled: true,
        filters: [
          {
            key: 'environment',
            type: 'EQUAL',
            value: 'prod',
          },
          {
            key: 'app',
            type: 'EQUAL',
            value: 'wordpress',
          },
          {
            key: 'cluster',
            type: 'EQUAL',
            value: 'PXCCluster1',
          },
        ],
        for: '300s',
        last_notified: '',
        params: [
          {
            float: 75,
            name: 'threshold',
            type: 'FLOAT',
          },
        ],
        severity: 'SEVERITY_WARNING',
        summary: 'High network throughput in - Mnfcg - Dev',
        template: {
          name: 'test 4',
          params: [
            {
              float: {
                default: 75,
              },
              name: 'threshold',
              type: 'FLOAT',
              unit: 'PERCENTAGE',
            },
          ],
          summary: 'Test 4',
        },
      },
      ruleId: 'test 4',
      createdAt: '2020-11-25 16:53:39.366',
      disabled: true,
      duration: '5 minutes',
      filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
      severity: 'Warning',
      summary: 'High network throughput in - Mnfcg - Dev',
      threshold: '75 %',
      lastNotified: '',
    });
  });

  test('formatRules', () => {
    expect(formatRules(undefined)).toEqual([]);

    expect(formatRules(null)).toEqual([]);

    expect(formatRules([])).toEqual([]);

    expect(formatRules([rulesStubs[0], rulesStubs[3]])).toEqual([
      {
        rawValues: {
          rule_id: 'test 1',
          channels: [],
          created_at: '2020-11-25T16:53:39.366Z',
          disabled: false,
          filters: [
            {
              key: 'environment',
              type: 'EQUAL',
              value: 'prod',
            },
            {
              key: 'app',
              type: 'EQUAL',
              value: 'wordpress',
            },
            {
              key: 'cluster',
              type: 'EQUAL',
              value: 'PXCCluster1',
            },
          ],
          for: '120s',
          last_notified: '2020-11-25T16:53:39.366Z',
          params: [
            {
              bool: true,
              name: 'threshold',
              type: 'BOOL',
            },
          ],
          severity: 'SEVERITY_CRITICAL',
          summary: 'Database down - HR - Prod',
          template: {
            name: 'test 1',
            params: [
              {
                bool: {
                  default: true,
                },
                name: 'threshold',
                type: 'BOOL',
              },
            ],
            summary: 'Test 1',
          },
        },
        ruleId: 'test 1',
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
        rawValues: {
          rule_id: 'test 4',
          channels: [],
          created_at: '2020-11-25T16:53:39.366Z',
          disabled: true,
          filters: [
            {
              key: 'environment',
              type: 'EQUAL',
              value: 'prod',
            },
            {
              key: 'app',
              type: 'EQUAL',
              value: 'wordpress',
            },
            {
              key: 'cluster',
              type: 'EQUAL',
              value: 'PXCCluster1',
            },
          ],
          for: '300s',
          last_notified: '',
          params: [
            {
              float: 75,
              name: 'threshold',
              type: 'FLOAT',
            },
          ],
          severity: 'SEVERITY_WARNING',
          summary: 'High network throughput in - Mnfcg - Dev',
          template: {
            name: 'test 4',
            params: [
              {
                float: {
                  default: 75,
                },
                name: 'threshold',
                type: 'FLOAT',
                unit: 'PERCENTAGE',
              },
            ],
            summary: 'Test 4',
          },
        },
        ruleId: 'test 4',
        createdAt: '2020-11-25 16:53:39.366',
        disabled: true,
        duration: '5 minutes',
        filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
        severity: 'Warning',
        summary: 'High network throughput in - Mnfcg - Dev',
        threshold: '75 %',
        lastNotified: '',
      },
    ]);
  });
});
