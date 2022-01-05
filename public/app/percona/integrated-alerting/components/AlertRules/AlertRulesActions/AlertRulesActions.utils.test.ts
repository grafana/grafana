import { TemplateParamType, TemplateParamUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleCopyPayload, AlertRuleSeverity } from '../AlertRules.types';
import { createAlertRuleCopyPayload } from './AlertRulesActions.utils';

describe('AlertRulesActions.utils.test::utils', () => {
  it('should correctly create a copy payload', () => {
    expect(
      createAlertRuleCopyPayload({
        ruleId: '1',
        name: 'Rule one',
        createdAt: '10 Dec 2021',
        disabled: true,
        filters: [],
        lastNotified: '',
        severity: AlertRuleSeverity.SEVERITY_CRITICAL,
        params: [
          {
            name: 'Param 1',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: '',
            value: 10,
            float: {
              min: 5,
              max: 20,
              hasDefault: false,
              hasMax: true,
              hasMin: true,
            },
          },
          {
            name: 'Param 2',
            type: TemplateParamType.FLOAT,
            unit: TemplateParamUnit.PERCENTAGE,
            summary: '',
            value: 15,
            float: {
              min: 10,
              max: 20,
              hasDefault: false,
              hasMax: true,
              hasMin: true,
            },
          },
        ],
        expr: '',
        duration: '10s',
        rawValues: {
          channels: [],
          custom_labels: {},
          created_at: '10 Dec 2021',
          disabled: false,
          filters: [],
          default_for: '15s',
          for: '10s',
          params_values: [
            {
              name: 'Param 1',
              type: 'FLOAT',
              float: 10,
            },
            {
              name: 'Param 2',
              type: 'FLOAT',
              float: 15,
            },
          ],
          params_definitions: [
            {
              name: 'Param 1',
              type: TemplateParamType.FLOAT,
              unit: TemplateParamUnit.PERCENTAGE,
              summary: '',
            },
            {
              name: 'Param 2',
              type: TemplateParamType.FLOAT,
              unit: TemplateParamUnit.PERCENTAGE,
              summary: '',
            },
          ],
          severity: 'SEVERITY_CRITICAL',
          default_severity: AlertRuleSeverity.SEVERITY_CRITICAL,
          name: 'Rule one',
          expr: 'string',
          expr_template: 'string',
          rule_id: '1',
          template_name: 'Template one',
          summary: 'string',
        },
      })
    ).toEqual<AlertRuleCopyPayload>({
      channel_ids: [],
      disabled: true,
      filters: [],
      custom_labels: {},
      for: '10s',
      params: [
        {
          name: 'Param 1',
          type: 'FLOAT',
          float: 10,
        },
        {
          name: 'Param 2',
          type: 'FLOAT',
          float: 15,
        },
      ],
      severity: 'SEVERITY_CRITICAL',
      name: 'Copy of Rule one',
      source_rule_id: '1',
    });
  });
});
