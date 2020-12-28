import { AddAlertRuleFormValues, Severity } from './AddAlertRuleModal.types';
import {
  formatCreateAPIPayload,
  formatFilter,
  formatFilters,
  formatTemplateOptions,
  formatThreshold,
  formatUpdateAPIPayload,
  formatEditFilter,
  formatEditFilters,
  formatEditTemplate,
  formatEditSeverity,
  formatEditThreshold,
  formatEditNotificationChannel,
  formatEditNotificationChannels,
} from './AddAlertRuleModal.utils';

describe('AddAlertRuleModal utils', () => {
  test('formatThreshold', () => {
    expect(formatThreshold('2.')).toEqual({
      name: 'threshold',
      float: 2,
      type: 'FLOAT',
    });

    expect(formatThreshold('.2')).toEqual({
      name: 'threshold',
      float: 0.2,
      type: 'FLOAT',
    });

    expect(formatThreshold('2.2')).toEqual({
      name: 'threshold',
      float: 2.2,
      type: 'FLOAT',
    });

    expect(formatThreshold('2')).toEqual({
      name: 'threshold',
      float: 2,
      type: 'FLOAT',
    });

    expect(formatThreshold('')).toEqual({
      name: 'threshold',
      string: '',
      type: 'STRING',
    });

    expect(formatThreshold('true')).toEqual({
      name: 'threshold',
      bool: true,
      type: 'BOOL',
    });
  });

  test('formatFilter', () => {
    expect(formatFilter('key=value')).toEqual({
      key: 'key',
      value: 'value',
      type: 'EQUAL',
    });

    expect(formatFilter('key=')).toEqual({
      key: 'key',
      value: '',
      type: 'EQUAL',
    });

    expect(formatFilter('=')).toEqual({
      key: '',
      value: '',
      type: 'EQUAL',
    });

    expect(formatFilter('=value')).toEqual({
      key: '',
      value: 'value',
      type: 'EQUAL',
    });

    expect(formatFilter('')).toEqual({
      key: '',
      value: '',
      type: 'EQUAL',
    });
  });

  test('formatFilters', () => {
    expect(formatFilters('')).toEqual([]);
    expect(formatFilters('=')).toEqual([
      {
        key: '',
        value: '',
        type: 'EQUAL',
      },
    ]);
    expect(formatFilters('test=xyz')).toEqual([
      {
        key: 'test',
        value: 'xyz',
        type: 'EQUAL',
      },
    ]);
    expect(formatFilters('  test=xyz, ijk=,   foo =bar,\nzyx=abc, \naaa=   zzz ')).toEqual([
      {
        key: 'test',
        value: 'xyz',
        type: 'EQUAL',
      },
      {
        key: 'ijk',
        value: '',
        type: 'EQUAL',
      },
      {
        key: 'foo ',
        value: 'bar',
        type: 'EQUAL',
      },
      {
        key: 'zyx',
        value: 'abc',
        type: 'EQUAL',
      },
      {
        key: 'aaa',
        value: '   zzz',
        type: 'EQUAL',
      },
    ]);
  });

  test('formatTemplateOptions', () => {
    expect(formatTemplateOptions([])).toEqual([]);
    expect(
      formatTemplateOptions([
        { summary: 'test summary 1', name: 'testsum1', source: 'SAAS', created_at: 'test', yaml: 'test' },
        { summary: '', name: '', source: 'SAAS', created_at: 'test', yaml: 'test' },
        { summary: '   ', name: 'test2', source: 'SAAS', created_at: 'test', yaml: 'test' },
      ])
    ).toEqual([
      {
        value: 'testsum1',
        label: 'test summary 1',
      },
      {
        value: '',
        label: '',
      },
      {
        value: 'test2',
        label: '   ',
      },
    ]);
  });

  test('formatCreateAPIPayload', () => {
    const inputData: AddAlertRuleFormValues = {
      enabled: false,
      duration: 123,
      filters: 'test=filter,',
      name: 'test name',
      notificationChannels: [
        { value: 'pagerDuty', label: 'Pager Duty' },
        { value: 'email', label: 'email' },
        { value: 'slack', label: 'Slack' },
      ],
      severity: { value: Severity.SEVERITY_CRITICAL, label: 'Critical' },
      template: { value: 'Test Template', label: 'Test Template' },
      threshold: 'true',
    };
    expect(formatCreateAPIPayload(inputData)).toEqual({
      custom_labels: {},
      disabled: true,
      channel_ids: ['pagerDuty', 'email', 'slack'],
      filters: [
        {
          key: 'test',
          value: 'filter',
          type: 'EQUAL',
        },
        {
          key: '',
          value: '',
          type: 'EQUAL',
        },
      ],
      for: '123s',
      params: [
        {
          name: 'threshold',
          bool: true,
          type: 'BOOL',
        },
      ],
      severity: Severity.SEVERITY_CRITICAL,
      template_name: 'Test Template',
      summary: 'test name',
    });
  });

  test('formatUpdateAPIPayload', () => {
    const inputData: AddAlertRuleFormValues = {
      enabled: false,
      duration: 123,
      filters: 'test=filter,',
      name: 'test name',
      notificationChannels: [
        { value: 'pagerDuty', label: 'Pager Duty' },
        { value: 'email', label: 'email' },
        { value: 'slack', label: 'Slack' },
      ],
      severity: { value: Severity.SEVERITY_CRITICAL, label: 'Critical' },
      template: { value: 'Test Template', label: 'Test Template' },
      threshold: 'true',
    };
    expect(formatUpdateAPIPayload('testId', inputData)).toEqual({
      rule_id: 'testId',
      custom_labels: {},
      disabled: true,
      channel_ids: ['pagerDuty', 'email', 'slack'],
      filters: [
        {
          key: 'test',
          value: 'filter',
          type: 'EQUAL',
        },
        {
          key: '',
          value: '',
          type: 'EQUAL',
        },
      ],
      for: '123s',
      params: [
        {
          name: 'threshold',
          bool: true,
          type: 'BOOL',
        },
      ],
      severity: Severity.SEVERITY_CRITICAL,
      template_name: 'Test Template',
      summary: 'test name',
    });
  });

  test('formatEditFilter', () => {
    expect(
      formatEditFilter({
        key: 'testKey',
        type: 'EQUAL',
        value: 'testValue',
      })
    ).toEqual('testKey=testValue');
  });

  test('formatEditFilter', () => {
    expect(
      formatEditFilter({
        key: 'testKey',
        type: 'EQUAL',
        value: 'testValue',
      })
    ).toEqual('testKey=testValue');
  });

  test('formatEditFilters', () => {
    expect(formatEditFilters(undefined)).toEqual('');

    expect(formatEditFilters(null)).toEqual('');

    expect(
      formatEditFilters([
        {
          key: 'testKey1',
          type: 'EQUAL',
          value: 'testValue1',
        },
        {
          key: 'testKey2',
          type: 'EQUAL',
          value: 'testValue2',
        },
      ])
    ).toEqual('testKey1=testValue1, testKey2=testValue2');
  });

  test('formatEditTemplate', () => {
    expect(formatEditTemplate({ name: 'test1', summary: 'Test 1', params: [] })).toEqual({
      value: 'test1',
      label: 'Test 1',
    });
  });

  test('formatEditSeverity', () => {
    expect(formatEditSeverity(Severity.SEVERITY_CRITICAL)).toEqual({ value: 'SEVERITY_CRITICAL', label: 'Critical' });
  });

  test('formatEditNotificationChannel', () => {
    expect(formatEditNotificationChannel({ channel_id: 'test_ch', summary: 'Test channel' })).toEqual({
      value: 'test_ch',
      label: 'Test channel',
    });
  });

  test('formatEditNotificationChannels', () => {
    expect(
      formatEditNotificationChannels([
        {
          channel_id: 'test_ch_1',
          summary: 'Test channel 1',
        },
        {
          channel_id: 'test_ch_2',
          summary: 'Test channel 2',
        },
      ])
    ).toEqual([
      {
        value: 'test_ch_1',
        label: 'Test channel 1',
      },
      {
        value: 'test_ch_2',
        label: 'Test channel 2',
      },
    ]);
  });

  test('formatEditNotificationChannels', () => {
    expect(formatEditThreshold([])).toBeNull();

    expect(formatEditThreshold(undefined)).toBeNull();

    expect(
      formatEditThreshold([
        {
          name: 'threshold',
          type: 'BOOL',
          bool: true,
        },
      ])
    ).toEqual('true');

    expect(
      formatEditThreshold([
        {
          name: 'threshold',
          type: 'FLOAT',
          float: 2.3,
        },
      ])
    ).toEqual('2.3');

    expect(
      formatEditThreshold([
        {
          name: 'threshold',
          type: 'STRING',
          string: 'test',
        },
      ])
    ).toEqual('test');

    expect(
      formatEditThreshold([
        {
          name: 'threshold',
          type: 'PARAM_TYPE_INVALID',
        },
      ])
    ).toBeNull();
  });
});
