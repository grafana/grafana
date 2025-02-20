import { produce } from 'immer';
import { HttpResponse, delay, http } from 'msw';

export const MOCK_GRAFANA_ALERT_RULE_TITLE = 'Test alert';

import {
  GrafanaRuleDefinition,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from '../../../../../../types/unified-alerting-dto';
import { AlertGroupUpdated } from '../../../api/alertRuleApi';
import {
  getHistoryResponse,
  grafanaRulerRule,
  namespaceByUid,
  namespaces,
  time_0,
  time_plus_30,
} from '../../grafanaRulerApi';
import { HandlerOptions } from '../configure';
export const rulerRulesHandler = () => {
  return http.get(`/api/ruler/grafana/api/v1/rules`, () => {
    const response = Object.entries(namespaces).reduce<RulerRulesConfigDTO>((acc, [namespaceUid, groups]) => {
      acc[namespaceByUid[namespaceUid].name] = groups;
      return acc;
    }, {});

    return HttpResponse.json<RulerRulesConfigDTO>(response);
  });
};

export const prometheusRulesHandler = () => {
  return http.get('/api/prometheus/grafana/api/v1/rules', () => {
    return HttpResponse.json<PromRulesResponse>({ status: 'success', data: { groups: [] } });
  });
};

export const getRulerRuleNamespaceHandler = () =>
  http.get<{ folderUid: string }>(`/api/ruler/grafana/api/v1/rules/:folderUid`, ({ params: { folderUid } }) => {
    // This mimic API response as closely as possible - Invalid folderUid returns 403
    const namespace = namespaces[folderUid];
    if (!namespace) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json<RulerRulesConfigDTO>({
      [namespaceByUid[folderUid].name]: namespaces[folderUid],
    });
  });

export const updateRulerRuleNamespaceHandler = (options?: HandlerOptions) =>
  http.post<{ folderUid: string }>(`/api/ruler/grafana/api/v1/rules/:folderUid`, async ({ params }) => {
    const { folderUid } = params;

    // @TODO make this more generic so we can use this in other endpoints too
    if (options?.delay !== undefined) {
      await delay(options.delay);
    }

    if (options?.response) {
      return options.response;
    }

    // This mimic API response as closely as possible.
    // Invalid folderUid returns 403 but invalid group will return 202 with empty list of rules
    const namespace = namespaces[folderUid];
    if (!namespace) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json<AlertGroupUpdated>({
      message: 'updated',
      updated: [],
    });
  });

export const rulerRuleGroupHandler = (options?: HandlerOptions) => {
  return http.get<{ folderUid: string; groupName: string }>(
    `/api/ruler/grafana/api/v1/rules/:folderUid/:groupName`,
    ({ params: { folderUid, groupName } }) => {
      if (options?.response) {
        return options.response;
      }

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

export const deleteRulerRuleGroupHandler = (options?: HandlerOptions) =>
  http.delete<{ folderUid: string; groupName: string }>(
    `/api/ruler/grafana/api/v1/rules/:folderUid/:groupName`,
    ({ params: { folderUid } }) => {
      if (options?.response) {
        return options.response;
      }

      const namespace = namespaces[folderUid];
      if (!namespace) {
        return new HttpResponse(null, { status: 403 });
      }

      return HttpResponse.json(
        {
          message: 'Rules deleted',
        },
        { status: 202 }
      );
    }
  );

export const rulerRuleHandler = () => {
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

export const rulerRuleVersionHistoryHandler = () => {
  const grafanaRuleVersions = [
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 6;
      draft.grafana_alert.updated = '2025-01-18T09:35:17.000Z';
      draft.grafana_alert.updated_by = {
        uid: 'service',
        name: '',
      };
    }),
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 5;
      draft.grafana_alert.updated = '2025-01-17T09:35:17.000Z';
      draft.grafana_alert.updated_by = {
        uid: '__alerting__',
        name: '',
      };
    }),
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 4;
      draft.grafana_alert.title = 'Some new title';
      draft.grafana_alert.updated = '2025-01-16T09:35:17.000Z';
      draft.grafana_alert.updated_by = {
        uid: 'different',
        name: 'different user',
      };
    }),
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 3;
      draft.grafana_alert.updated = '2025-01-15T09:35:17.000Z';
      draft.grafana_alert.updated_by = {
        uid: '1',
        name: 'user1',
      };
    }),
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 2;
      draft.grafana_alert.updated = '2025-01-14T09:35:17.000Z';
      draft.for = '2h';
      draft.labels.foo = 'bar';
      draft.grafana_alert.notification_settings = { receiver: 'another receiver' };
      draft.grafana_alert.updated_by = {
        uid: 'foo',
        name: '',
      };
    }),
    produce(grafanaRulerRule, (draft: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
      draft.grafana_alert.version = 1;
      draft.grafana_alert.updated = '2025-01-13T09:35:17.000Z';
      draft.grafana_alert.updated_by = null;
    }),
  ];

  return http.get<{ uid: string }>(`/api/ruler/grafana/api/v1/rule/:uid/versions`, ({ params: { uid } }) => {
    return HttpResponse.json(grafanaRuleVersions);
  });
};

export const historyHandler = () => {
  return http.get('/api/v1/rules/history', () => {
    return HttpResponse.json(getHistoryResponse([time_0, time_0, time_plus_30, time_plus_30]));
  });
};

const handlers = [
  rulerRulesHandler(),
  prometheusRulesHandler(),
  getRulerRuleNamespaceHandler(),
  rulerRuleGroupHandler(),
  rulerRuleHandler(),
  historyHandler(),
  updateRulerRuleNamespaceHandler(),
  deleteRulerRuleGroupHandler(),
  rulerRuleVersionHistoryHandler(),
];
export default handlers;
