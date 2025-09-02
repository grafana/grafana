import { produce } from 'immer';
import { HttpResponse, delay, http } from 'msw';

export const MOCK_GRAFANA_ALERT_RULE_TITLE = 'Test alert';

import {
  GrafanaAlertState,
  GrafanaRuleDefinition,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
  isGrafanaAlertState,
} from '../../../../../../types/unified-alerting-dto';
import { GrafanaGroupUpdatedResponse } from '../../../api/alertRuleModel';
import { getHistoryResponse, grafanaRulerRule, rulerTestDb, time_0, time_plus_30 } from '../../grafanaRulerApi';
import { HandlerOptions } from '../configure';

export const rulerRulesHandler = () => {
  return http.get(`/api/ruler/grafana/api/v1/rules`, () =>
    HttpResponse.json<RulerRulesConfigDTO>(rulerTestDb.getRulerConfig())
  );
};

export const prometheusRulesHandler = () => {
  return http.get('/api/prometheus/grafana/api/v1/rules', () => {
    return HttpResponse.json<PromRulesResponse>({ status: 'success', data: { groups: [] } });
  });
};

export const getRulerRuleNamespaceHandler = () =>
  http.get<{ folderUid: string }>(`/api/ruler/grafana/api/v1/rules/:folderUid`, ({ params: { folderUid } }) => {
    // This mimic API response as closely as possible - Invalid folderUid returns 403
    const namespace = rulerTestDb.getNamespace(folderUid);
    if (!namespace) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json<RulerRulesConfigDTO>(namespace);
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
    const namespace = rulerTestDb.getNamespace(folderUid);
    if (!namespace) {
      return new HttpResponse(null, { status: 403 });
    }

    return HttpResponse.json<GrafanaGroupUpdatedResponse>({
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

      const namespace = rulerTestDb.getNamespace(folderUid);
      if (!namespace) {
        return new HttpResponse(null, { status: 403 });
      }

      const matchingGroup = rulerTestDb.getGroup(folderUid, groupName);

      if (!matchingGroup) {
        return new HttpResponse({ message: 'group does not exist' }, { status: 404 });
      }

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

      const namespace = rulerTestDb.getNamespace(folderUid);
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

export const deleteRulerRulePermanentlyHandler = (options?: HandlerOptions) =>
  http.delete<{ ruleGuid: string }>(
    `/api/ruler/grafana/api/v1/trash/rule/guid/:ruleGuid`,
    ({ params: { ruleGuid } }) => {
      if (options?.response) {
        return options.response;
      }

      if (grafanaRulerRule.grafana_alert.guid !== ruleGuid) {
        return new HttpResponse(null, { status: 403 });
      }

      return HttpResponse.json({ status: 202 });
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
      if (!draft.labels) {
        draft.labels = {};
      }
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

const filterHistoryByState = (
  data: ReturnType<typeof getHistoryResponse>,
  previous?: GrafanaAlertState,
  current?: GrafanaAlertState
) => {
  if (!previous && !current) {
    return data;
  }
  const stateMap: Record<string, string> = {
    firing: 'Alerting',
    normal: 'Normal',
    pending: 'Pending',
  };
  const filteredRecords: unknown[] = [];
  const filteredTimes: number[] = [];
  const filteredLabels: unknown[] = [];

  (data.data.values[1] as Array<Record<string, unknown>>).forEach((record: Record<string, unknown>, index: number) => {
    const matchesPrevious = !previous || record.previous === (stateMap[previous.toLowerCase()] || previous);
    const matchesCurrent = !current || record.current === (stateMap[current.toLowerCase()] || current);

    if (matchesPrevious && matchesCurrent) {
      filteredRecords.push(record);
      filteredTimes.push((data.data.values[0] as number[])[index]);
      filteredLabels.push((data.data.values[2] as unknown[])[index]);
    }
  });

  return {
    ...data,
    data: {
      values: [filteredTimes, filteredRecords, filteredLabels],
    },
  };
};

export const historyHandler = () => {
  return http.get('/api/v1/rules/history', ({ request }) => {
    const url = new URL(request.url);
    const previousParam = url.searchParams.get('previous');
    const currentParam = url.searchParams.get('current');

    const previous = previousParam && isGrafanaAlertState(previousParam) ? previousParam : undefined;
    const current = currentParam && isGrafanaAlertState(currentParam) ? currentParam : undefined;

    const fullData = getHistoryResponse([time_0, time_0, time_plus_30, time_plus_30]);
    const filteredData = filterHistoryByState(fullData, previous, current);

    return HttpResponse.json(filteredData);
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
  deleteRulerRulePermanentlyHandler(),
  rulerRuleVersionHistoryHandler(),
];
export default handlers;
