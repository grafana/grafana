import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { RulerAlertingRuleDTO } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../types/rule-form';

import {
  alertingRulerRuleToRuleForm,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
  getDefaultFormValues,
} from './rule-form';

describe('formValuesToRulerGrafanaRuleDTO', () => {
  it('should correctly convert rule form values', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      condition: 'A',
    };

    expect(formValuesToRulerGrafanaRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should not save both instant and range type queries', () => {
    const defaultValues = getDefaultFormValues();

    const values: RuleFormValues = {
      ...defaultValues,
      queries: [
        {
          refId: 'A',
          relativeTimeRange: { from: 900, to: 1000 },
          datasourceUid: 'dsuid',
          model: { refId: 'A', expr: '', instant: true, range: true } as PromQuery,
          queryType: 'query',
        },
      ],
      condition: 'A',
    };

    expect(formValuesToRulerGrafanaRuleDTO(values)).toMatchSnapshot();
  });

  it('should set keep_firing_for if values are populated', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      type: RuleFormType.cloudAlerting,
      condition: 'A',
      keepFiringForTime: 1,
      keepFiringForTimeUnit: 'm',
    };

    expect(formValuesToRulerRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should not set keep_firing_for if values are undefined', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      type: RuleFormType.cloudAlerting,
      condition: 'A',
    };

    expect(formValuesToRulerRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should parse keep_firing_for', () => {
    const rule: RulerAlertingRuleDTO = {
      alert: 'A',
      expr: 'B',
      for: '1m',
      keep_firing_for: '1m',
      labels: {},
    };

    expect(alertingRulerRuleToRuleForm(rule)).toMatchSnapshot();
  });

  it('should set keepFiringForTime and keepFiringForTimeUnit to undefined if keep_firing_for not set', () => {
    const rule: RulerAlertingRuleDTO = {
      alert: 'A',
      expr: 'B',
      for: '1m',
      labels: {},
    };

    expect(alertingRulerRuleToRuleForm(rule)).toMatchSnapshot();
  });
});
