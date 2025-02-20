import { Chance } from 'chance';

import {
  GrafanaAlertStateDecision,
  PromAlertingRuleState,
  PromRulesResponse,
  PromRuleType,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

export function getRulerRulesResponse(folderName: string, folderUid: string, seed = 1): RulerRulesConfigDTO {
  const random = Chance(seed);
  return {
    [folderName]: [
      {
        name: 'foo',
        interval: '1m',
        rules: [
          {
            annotations: {},
            labels: {},
            expr: '',
            for: '5m',
            grafana_alert: {
              version: 2,
              id: '49',
              title: random.sentence({ words: 3 }),
              condition: 'B',
              data: [
                {
                  refId: 'A',
                  queryType: '',
                  relativeTimeRange: {
                    from: 600,
                    to: 0,
                  },
                  datasourceUid: 'gdev-testdata',
                  model: {
                    hide: false,
                    intervalMs: 1000,
                    maxDataPoints: 43200,
                    refId: 'A',
                  },
                },
              ],
              uid: random.guid(),
              namespace_uid: folderUid,
              rule_group: 'my-group',
              no_data_state: GrafanaAlertStateDecision.NoData,
              exec_err_state: GrafanaAlertStateDecision.Error,
              is_paused: false,
            },
          },
        ],
      },
    ],
  };
}

export function getPrometheusRulesResponse(folderName: string, seed = 1): PromRulesResponse {
  const random = Chance(seed);
  return {
    status: 'success',
    data: {
      groups: [
        {
          name: 'foo',
          file: folderName,
          rules: [
            {
              alerts: [],
              labels: {},
              state: PromAlertingRuleState.Inactive,
              name: random.sentence({ words: 3 }),
              query:
                '[{"refId":"A","queryType":"","relativeTimeRange":{"from":600,"to":0},"datasourceUid":"gdev-testdata","model":{"hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A"}},{"refId":"B","queryType":"","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"__expr__","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","intervalMs":1000,"maxDataPoints":43200,"refId":"B","type":"threshold"}}]',
              duration: 300,
              health: 'ok',
              type: PromRuleType.Alerting,
              lastEvaluation: '0001-01-01T00:00:00Z',
              evaluationTime: 0,
            },
          ],
          interval: 60,
          lastEvaluation: '0001-01-01T00:00:00Z',
          evaluationTime: 0,
        },
      ],
      totals: {
        inactive: 1,
      },
    },
  };
}
