import {
  SourceDescription,
  TemplateParamType,
  TemplateParamUnit,
} from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleCreatePayload, AlertRuleFilterType, AlertRuleUpdatePayload } from '../AlertRules.types';
import { AddAlertRuleFormValues, FiltersForm } from './AddAlertRuleModal.types';
import {
  formatCreateAPIPayload,
  formatFilters,
  formatTemplateOptions,
  formatUpdateAPIPayload,
  formatEditFilters,
  formatEditTemplate,
  formatEditSeverity,
  formatEditNotificationChannel,
  formatEditNotificationChannels,
  minValidator,
  maxValidator,
} from './AddAlertRuleModal.utils';

describe('AddAlertRuleModal utils', () => {
  test('formatFilters', () => {
    const filterObject: FiltersForm[] = [
      {
        label: 'key',
        value: 'value',
        operators: { label: AlertRuleFilterType.EQUAL, value: AlertRuleFilterType.EQUAL },
      },
    ];
    expect(formatFilters(filterObject)).toEqual([
      {
        key: 'key',
        value: 'value',
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
          severity: 'SEVERITY_CRITICAL',
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
          severity: 'SEVERITY_ERROR',
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
          severity: 'SEVERITY_CRITICAL',
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
      filters: [
        {
          label: 'key',
          value: 'value',
          operators: { label: AlertRuleFilterType.EQUAL, value: AlertRuleFilterType.EQUAL },
        },
        {
          label: 'key',
          value: 'value',
          operators: { label: AlertRuleFilterType.REGEX, value: AlertRuleFilterType.REGEX },
        },
      ],
      name: 'test name',
      notificationChannels: [
        { value: 'pagerDuty', label: 'Pager Duty' },
        { value: 'email', label: 'email' },
        { value: 'slack', label: 'Slack' },
      ],
      severity: { value: 'SEVERITY_CRITICAL', label: 'Critical' },
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
          key: 'key',
          value: 'value',
          type: 'EQUAL',
        },
        {
          key: 'key',
          value: 'value',
          type: 'REGEX',
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
      severity: 'SEVERITY_CRITICAL',
      template_name: 'Test Template',
      name: 'test name',
    });
  });

  test('formatUpdateAPIPayload', () => {
    const inputData: AddAlertRuleFormValues = {
      enabled: false,
      duration: 123,
      filters: [
        {
          label: 'key',
          value: 'value',
          operators: { label: AlertRuleFilterType.EQUAL, value: AlertRuleFilterType.EQUAL },
        },
      ],
      name: 'test name',
      notificationChannels: [
        { value: 'pagerDuty', label: 'Pager Duty' },
        { value: 'email', label: 'email' },
        { value: 'slack', label: 'Slack' },
      ],
      severity: { value: 'SEVERITY_CRITICAL', label: 'Critical' },
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
          key: 'key',
          value: 'value',
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
      severity: 'SEVERITY_CRITICAL',
      template_name: 'Test Template',
      name: 'test name',
    });
  });

  test('formatEditFilters', () => {
    expect(formatEditFilters(undefined)).toEqual([]);

    expect(formatEditFilters(null)).toEqual([]);

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
    ).toEqual([
      { label: 'testKey1', operators: { label: '= (EQUAL)', value: '=' }, value: 'testValue1' },
      { label: 'testKey2', operators: { label: '= (EQUAL)', value: '=' }, value: 'testValue2' },
    ]);
  });

  test('formatEditTemplate', () => {
    expect(formatEditTemplate('test1', 'Test 1')).toEqual({
      value: 'test1',
      label: 'Test 1',
    });
  });

  test('formatEditSeverity', () => {
    expect(formatEditSeverity('SEVERITY_CRITICAL')).toEqual({ value: 'SEVERITY_CRITICAL', label: 'Critical' });
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
