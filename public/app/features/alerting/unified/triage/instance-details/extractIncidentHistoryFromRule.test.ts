import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { mockDataQuery } from '../../mocks';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType } from '../../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';

import { extractIncidentHistoryFromRule } from './extractIncidentHistoryFromRule';

function buildRuleDto(overrides: Partial<RulerGrafanaRuleDTO> = {}): RulerGrafanaRuleDTO {
  const dataQuery = mockDataQuery({ refId: 'A' });

  return {
    ...(formValuesToRulerGrafanaRuleDTO({
      ...getDefaultFormValues(RuleFormType.grafana),
      name: 'API availability',
      type: RuleFormType.grafana,
      condition: 'A',
      queries: [dataQuery],
    }) as RulerGrafanaRuleDTO),
    ...overrides,
  };
}

describe('extractIncidentHistoryFromRule', () => {
  it('returns undefined when no incident metadata or annotations exist', () => {
    expect(extractIncidentHistoryFromRule(buildRuleDto())).toBeUndefined();
  });

  it('returns incident history from rule metadata when present', () => {
    const incidentHistory = {
      incidents: [{ id: 'inc-1', title: 'API outage', status: 'resolved' }],
    };

    const rule = buildRuleDto({
      grafana_alert: {
        ...buildRuleDto().grafana_alert,
        metadata: {
          incident_history: incidentHistory,
        },
      },
    });

    expect(extractIncidentHistoryFromRule(rule)).toEqual(incidentHistory);
  });

  it('returns linked incident annotation uids when metadata is absent', () => {
    const rule = buildRuleDto({
      annotations: {
        incident_uid: 'inc-123',
      },
    });

    expect(extractIncidentHistoryFromRule(rule)).toEqual({
      annotations: {
        incident_uid: 'inc-123',
      },
    });
  });
});
