import { GrafanaAlertState, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { mockDataQuery } from '../../mocks';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType } from '../../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';

import { createExplainAssistantContext } from './explainAssistantContext';

jest.mock('@grafana/assistant', () => {
  const actual = jest.requireActual('@grafana/assistant');
  return {
    ...actual,
    createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
  };
});

function buildRuleDto() {
  const dataQuery = mockDataQuery({ refId: 'A' });
  Object.assign(dataQuery.model, { expr: 'up{job="api"} == 0' });

  return formValuesToRulerGrafanaRuleDTO({
    ...getDefaultFormValues(RuleFormType.grafana),
    name: 'API availability',
    type: RuleFormType.grafana,
    condition: 'A',
    queries: [dataQuery],
    evaluateFor: '5m',
    evaluateEvery: '1m',
  }) as RulerGrafanaRuleDTO;
}

describe('createExplainAssistantContext', () => {
  it('builds structured assistant context for the alert instance', () => {
    const { createAssistantContextItem } = jest.requireMock('@grafana/assistant');
    createAssistantContextItem.mockClear();

    const rule = buildRuleDto();
    const description = 'Alert rule "API availability" monitors query A.';

    createExplainAssistantContext({
      rule,
      ruleUID: 'rule-uid-1',
      instanceLabels: { job: 'api', instance: 'server-1' },
      commonLabels: { team: 'platform' },
      instanceState: GrafanaAlertState.Alerting,
      description,
    });

    expect(createAssistantContextItem).toHaveBeenCalledWith('structured', {
      title: 'Alert instance: API availability',
      data: {
        rule: {
          uid: 'rule-uid-1',
          title: 'API availability',
          labels: rule.labels,
          annotations: rule.annotations,
          condition: 'A',
          queries: [
            {
              refId: 'A',
              datasourceUid: expect.any(String),
              expr: 'up{job="api"} == 0',
              expression: undefined,
            },
          ],
        },
        instance: {
          labels: { job: 'api', instance: 'server-1' },
          commonLabels: { team: 'platform' },
          state: GrafanaAlertState.Alerting,
        },
        description,
      },
    });
  });
});
