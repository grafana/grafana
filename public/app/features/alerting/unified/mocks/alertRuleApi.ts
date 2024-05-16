import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import {
  GrafanaAlertStateDecision,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { PreviewResponse, PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';
import { Annotation } from '../utils/constants';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(http.post(PREVIEW_URL, () => HttpResponse.json(result)));
}

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(http.get(PROM_RULES_URL, () => HttpResponse.json(result)));
}

const MOCK_NAMESPACE_UID = 'uuid020c61ef';

const grafanaRulerGroupName = 'grafana-group-1';
const grafanaRulerNamespace = { name: 'test-folder-1', uid: MOCK_NAMESPACE_UID };

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
    namespace_uid: MOCK_NAMESPACE_UID,
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

const namespaceByUid: Record<string, { name: string; uid: string }> = {
  [grafanaRulerNamespace.uid]: grafanaRulerNamespace,
};

const namespaces: Record<string, RulerRuleGroupDTO[]> = {
  [grafanaRulerNamespace.uid]: [grafanaRulerGroup],
};

export const rulerRulesHandler = () => {
  return http.get(`/api/ruler/grafana/api/v1/rules`, () => {
    const response = Object.entries(namespaces).reduce<RulerRulesConfigDTO>((acc, [namespaceUid, groups]) => {
      acc[namespaceByUid[namespaceUid].name] = groups;
      return acc;
    }, {});

    return HttpResponse.json<RulerRulesConfigDTO>(response);
  });
};

export const rulerRuleNamespaceHandler = () => {
  return http.get<{ folderUid: string }>(`/api/ruler/grafana/api/v1/rules/:folderUid`, ({ params: { folderUid } }) => {
    // This mimic API response as closely as possible - Invalid folderUid returns 403
    const namespace = namespaces[folderUid];
    if (!namespace) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json<RulerRulesConfigDTO>({
      [namespaceByUid[folderUid].name]: namespaces[folderUid],
    });
  });
};

export const rulerRuleGroupHandler = () => {
  return http.get<{ folderUid: string; groupName: string }>(
    `/api/ruler/grafana/api/v1/rules/:folderUid/:groupName`,
    ({ params: { folderUid, groupName } }) => {
      // This mimic API response as closely as possible.
      // Invalid folderUid returns 403 but invalid group will return 202 with empty list of rules
      const namespace = namespaces[folderUid];
      if (!namespace) {
        return new HttpResponse(null, { status: 403 });
      }

      const matchingGroup = namespace.find((group) => group.name === groupName);
      return HttpResponse.json<RulerRuleGroupDTO>({
        name: groupName,
        interval: matchingGroup?.interval,
        rules: matchingGroup?.rules ?? [],
      });
    }
  );
};

export const getAlertRuleHandler = () => {
  const grafanaRules = new Map<string, RulerGrafanaRuleDTO>(
    [grafanaRulerRule].map((rule) => [rule.grafana_alert.uid, rule])
  );

  return http.get<{ uid: string }>(`/api/ruler/grafana/api/v1/rule/:uid`, ({ params: { uid } }) => {
    const rule = grafanaRules.get(uid);
    if (!rule) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(rule);
  });
};
