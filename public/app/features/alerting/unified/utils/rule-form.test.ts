import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { RuleFormValues } from '../types/rule-form';

import { formValuesToRulerGrafanaRuleDTO, getDefaultFormValues } from './rule-form';

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
});
