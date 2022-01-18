import {
  Severity,
  SourceDescription,
  TemplateParamType,
  TemplateParamUnit,
} from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleCreatePayload, AlertRuleUpdatePayload } from '../AlertRules.types';
import { AddAlertRuleFormValues } from './AddAlertRuleModal.types';
import {
  formatCreateAPIPayload,
  formatFilter,
  formatFilters,
  formatTemplateOptions,
  formatUpdateAPIPayload,
  formatEditFilter,
  formatEditFilters,
  formatEditTemplate,
  formatEditSeverity,
  formatEditNotificationChannel,
  formatEditNotificationChannels,
  minValidator,
  maxValidator,
} from './AddAlertRuleModal.utils';

describe('AddAlertRuleModal utils', () => {
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
        {
          summary: 'test summary 1',
          name: 'testsum1',
          source: SourceDescription.SAAS,
          created_at: 'test',
          yaml: 'test',
          params: [],
          expr: '',
          severity: Severity.SEVERITY_CRITICAL,
          for: '200s',
        },
        {
          summary: '',
          name: '',
          source: SourceDescription.SAAS,
          created_at: 'test',
          yaml: 'test',
          params: [],
          expr: '',
          severity: Severity.SEVERITY_ERROR,
          for: '100s',
        },
        {
          summary: '   ',
          name: 'test2',
          source: SourceDescription.SAAS,
          created_at: 'test',
          yaml: 'test',
          params: [],
          expr: '',
          severity: Severity.SEVERITY_CRITICAL,
          for: '150s',
        },
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
      threshold: 10,
    };
    expect(
      formatCreateAPIPayload(inputData, [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: '',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 10,
          },
        },
      ])
    ).toEqual<AlertRuleCreatePayload>({
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
          float: 10,
          type: 'FLOAT',
        },
      ],
      severity: Severity.SEVERITY_CRITICAL,
      template_name: 'Test Template',
      name: 'test name',
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
      threshold: 10,
    };
    expect(
      formatUpdateAPIPayload('testId', inputData, [
        {
          name: 'threshold',
          type: TemplateParamType.FLOAT,
          unit: TemplateParamUnit.PERCENTAGE,
          summary: '',
          float: {
            hasDefault: true,
            hasMin: false,
            hasMax: false,
            default: 10,
          },
        },
      ])
    ).toEqual<AlertRuleUpdatePayload>({
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
          float: 10,
          type: 'FLOAT',
        },
      ],
      severity: Severity.SEVERITY_CRITICAL,
      template_name: 'Test Template',
      name: 'test name',
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
    expect(formatEditTemplate('test1', 'Test 1')).toEqual({
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

  test('minimum validator', () => {
    expect(minValidator(1)(-1)).not.toBeUndefined();
    expect(minValidator(1)(0)).not.toBeUndefined();
    expect(minValidator(0)(0)).toBeUndefined();
    expect(minValidator(0.2)(0.25)).toBeUndefined();
    expect(minValidator(0.99)(0.991)).toBeUndefined();
    expect(minValidator(1)(1)).toBeUndefined();
    expect(minValidator(1)(100)).toBeUndefined();
    expect(minValidator(-1)(1)).toBeUndefined();
    expect(minValidator(Infinity)(1)).not.toBeUndefined();
    expect(minValidator(1)(Infinity)).toBeUndefined();
    expect(minValidator(Number.MAX_VALUE)(1)).not.toBeUndefined();
    expect(minValidator(1)(Number.MAX_VALUE)).toBeUndefined();
  });

  test('maximum validator', () => {
    expect(maxValidator(1)(-1)).toBeUndefined();
    expect(maxValidator(1)(0)).toBeUndefined();
    expect(maxValidator(0)(0)).toBeUndefined();
    expect(maxValidator(0.2)(0.25)).not.toBeUndefined();
    expect(maxValidator(0.99)(0.991)).not.toBeUndefined();
    expect(maxValidator(1)(1)).toBeUndefined();
    expect(maxValidator(1)(100)).not.toBeUndefined();
    expect(maxValidator(-1)(1)).not.toBeUndefined();
    expect(maxValidator(Infinity)(1)).toBeUndefined();
    expect(maxValidator(1)(Infinity)).not.toBeUndefined();
    expect(maxValidator(Number.MAX_VALUE)(1)).toBeUndefined();
    expect(maxValidator(1)(Number.MAX_VALUE)).not.toBeUndefined();
  });
});
