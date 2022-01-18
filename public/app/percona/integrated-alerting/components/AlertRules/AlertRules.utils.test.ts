import { TemplateParamType, TemplateParamUnit } from '../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRule, AlertRuleSeverity } from './AlertRules.types';
import { formatDuration, formatFilter, formatRule, formatRules } from './AlertRules.utils';
import { rulesStubs } from './__mocks__/alertRulesStubs';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

describe('AlertRulesTable utils', () => {
  test('formatFilter', () => {
    expect(formatFilter({ key: 'testKey', type: 'EQUAL', value: '1337' })).toEqual('testKey=1337');
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
    expect(formatRule(rulesStubs[0])).toEqual<AlertRule>({
      rawValues: {
        rule_id: 'test 1',
        name: 'Test 1',
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
        default_for: '120s',
        last_notified: '2020-11-25T16:53:39.366Z',
        severity: 'SEVERITY_CRITICAL',
        default_severity: AlertRuleSeverity.SEVERITY_CRITICAL,
        template_name: 'test 1',
        expr_template: '',
        summary: 'Database down - HR - Prod',
        params_values: [
          {
            name: 'threshold',
            type: 'FLOAT',
            float: 15,
          },
        ],
        params_definitions: [
          {
            name: 'threshold',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: 'a threshold',
            float: {
              hasDefault: true,
              hasMin: false,
              hasMax: false,
              default: 10,
            },
          },
        ],
        expr:
          'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
      },
      params: [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 10,
          },
          value: 15,
        },
      ],
      ruleId: 'test 1',
      createdAt: '2020-11-25 16:53:39.366',
      disabled: false,
      duration: '2 minutes',
      filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
      severity: 'Critical',
      name: 'Test 1',
      lastNotified: '2020-11-25 16:53:39.366',
      expr:
        'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
    });

    expect(formatRule(rulesStubs[3])).toEqual<AlertRule>({
      rawValues: {
        rule_id: 'test 4',
        name: 'Test 4',
        template_name: 'test 4',
        channels: [
          { channel_id: 'test_ch', summary: 'Test Channel' },
          { channel_id: 'test_ch_2', summary: 'Test Channel 2' },
        ],
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
        default_for: '300s',
        last_notified: '',
        severity: 'SEVERITY_WARNING',
        default_severity: AlertRuleSeverity.SEVERITY_WARNING,
        summary: 'High network throughput in - Mnfcg - Dev',
        params_values: [
          {
            name: 'threshold',
            type: 'FLOAT',
            float: 75,
          },
        ],
        params_definitions: [
          {
            name: 'threshold',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: 'a threshold',
            float: {
              hasDefault: true,
              hasMin: false,
              hasMax: false,
              default: 75,
            },
          },
        ],
        expr_template: '',
        expr:
          'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
      },
      params: [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: 'a threshold',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 75,
          },
          value: 75,
        },
      ],
      ruleId: 'test 4',
      createdAt: '2020-11-25 16:53:39.366',
      disabled: true,
      duration: '5 minutes',
      filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
      severity: 'Warning',
      name: 'Test 4',
      lastNotified: '',
      expr:
        'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
    });
  });

  test('formatRules', () => {
    expect(formatRules(undefined)).toEqual([]);

    expect(formatRules(null)).toEqual([]);

    expect(formatRules([])).toEqual([]);

    expect(formatRules([rulesStubs[0], rulesStubs[3]])).toEqual<AlertRule[]>([
      {
        rawValues: {
          rule_id: 'test 1',
          name: 'Test 1',
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
          default_for: '120s',
          last_notified: '2020-11-25T16:53:39.366Z',
          severity: 'SEVERITY_CRITICAL',
          default_severity: AlertRuleSeverity.SEVERITY_CRITICAL,
          template_name: 'test 1',
          expr_template: '',
          summary: 'Database down - HR - Prod',
          params_values: [
            {
              name: 'threshold',
              type: 'FLOAT',
              float: 15,
            },
          ],
          params_definitions: [
            {
              name: 'threshold',
              type: TemplateParamType.FLOAT,
              unit: TemplateParamUnit.PERCENTAGE,
              summary: 'a threshold',
              float: {
                hasDefault: true,
                hasMin: false,
                hasMax: false,
                default: 10,
              },
            },
          ],
          expr:
            'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
        },
        params: [
          {
            name: 'threshold',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: 'a threshold',
            float: {
              hasDefault: true,
              hasMin: false,
              hasMax: false,
              default: 10,
            },
            value: 15,
          },
        ],
        ruleId: 'test 1',
        createdAt: '2020-11-25 16:53:39.366',
        disabled: false,
        duration: '2 minutes',
        filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
        severity: 'Critical',
        name: 'Test 1',
        lastNotified: '2020-11-25 16:53:39.366',
        expr:
          'sum by (node_name) (mongodb_ss_connections{conn_type="current"}) * 1024 * 1024↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> [[ .threshold ]]',
      },
      {
        rawValues: {
          rule_id: 'test 4',
          name: 'Test 4',
          template_name: 'test 4',
          channels: [
            { channel_id: 'test_ch', summary: 'Test Channel' },
            { channel_id: 'test_ch_2', summary: 'Test Channel 2' },
          ],
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
          default_for: '300s',
          last_notified: '',
          severity: 'SEVERITY_WARNING',
          default_severity: AlertRuleSeverity.SEVERITY_WARNING,
          summary: 'High network throughput in - Mnfcg - Dev',
          params_values: [
            {
              name: 'threshold',
              type: 'FLOAT',
              float: 75,
            },
          ],
          params_definitions: [
            {
              name: 'threshold',
              type: TemplateParamType.FLOAT,
              unit: TemplateParamUnit.PERCENTAGE,
              summary: 'a threshold',
              float: {
                hasDefault: true,
                hasMin: false,
                hasMax: false,
                default: 75,
              },
            },
          ],
          expr_template: '',
          expr:
            'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
        },
        params: [
          {
            name: 'threshold',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: 'a threshold',
            float: {
              hasDefault: true,
              hasMin: false,
              hasMax: false,
              default: 75,
            },
            value: 75,
          },
        ],
        ruleId: 'test 4',
        createdAt: '2020-11-25 16:53:39.366',
        disabled: true,
        duration: '5 minutes',
        filters: ['environment=prod', 'app=wordpress', 'cluster=PXCCluster1'],
        severity: 'Warning',
        name: 'Test 4',
        lastNotified: '',
        expr:
          'sum by (node_name) (mongodb_ss_mem_resident * 1024 * 1024)↵/ on (node_name) (node_memory_MemTotal_bytes)↵* 100↵> 20',
      },
    ]);
  });
});
