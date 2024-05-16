import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import {
  GrafanaAlertStateDecision,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { PreviewResponse, PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';
import { Annotation } from '../utils/constants';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(http.post(PREVIEW_URL, () => HttpResponse.json(result)));
}

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(http.get(PROM_RULES_URL, () => HttpResponse.json(result)));
}

const grafanaRulerGroupName = 'grafana-group-1';
export const grafanaRulerNamespace = { name: 'test-folder-1', uid: 'uuid020c61ef' };
export const grafanaRulerNamespace2 = { name: 'test-folder-2', uid: '6abdb25bc1eb' };

export const grafanaRulerRule: RulerGrafanaRuleDTO = {
  for: '5m',
  labels: {
    severity: 'critical',
    region: 'nasa',
  },
  annotations: {
    [Annotation.summary]: 'Test alert',
  },
  grafana_alert: {
    uid: '4d7125fee983',
    title: 'Grafana-rule',
    namespace_uid: 'uuid020c61ef',
    rule_group: grafanaRulerGroupName,
    data: [
      {
        refId: 'A',
        datasourceUid: 'datasource-uid',
        queryType: 'alerting',
        relativeTimeRange: { from: 1000, to: 2000 },
        model: {
          refId: 'A',
          expression: 'vector(1)',
          queryType: 'alerting',
          datasource: { uid: 'datasource-uid', type: 'prometheus' },
        },
      },
    ],
    condition: 'A',
    no_data_state: GrafanaAlertStateDecision.NoData,
    exec_err_state: GrafanaAlertStateDecision.Error,
    is_paused: false,
    notification_settings: undefined,
  },
};

export const grafanaRulerGroup: RulerRuleGroupDTO = {
  name: grafanaRulerGroupName,
  interval: '1m',
  rules: [grafanaRulerRule],
};

export const grafanaRulerEmptyGroup: RulerRuleGroupDTO = {
  name: 'empty-group',
  interval: '1m',
  rules: [],
};

export const namespaceByUid: Record<string, { name: string; uid: string }> = {
  [grafanaRulerNamespace.uid]: grafanaRulerNamespace,
  [grafanaRulerNamespace2.uid]: grafanaRulerNamespace2,
};

export const namespaces: Record<string, RulerRuleGroupDTO[]> = {
  [grafanaRulerNamespace.uid]: [grafanaRulerGroup],
  [grafanaRulerNamespace2.uid]: [grafanaRulerEmptyGroup],
};
