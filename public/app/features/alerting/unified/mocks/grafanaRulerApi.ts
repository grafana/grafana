import { HttpResponse, http } from 'msw';
import { SetupServer } from 'msw/node';

import { FieldType } from '@grafana/data';
import {
  GrafanaAlertStateDecision,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { PREVIEW_URL, PROM_RULES_URL, PreviewResponse } from '../api/alertRuleApi';
import { Annotation } from '../utils/constants';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(http.post(PREVIEW_URL, () => HttpResponse.json(result)));
}

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(http.get(PROM_RULES_URL, () => HttpResponse.json(result)));
}

export const grafanaRulerGroupName = 'grafana-group-1';
export const grafanaRulerGroupName2 = 'grafana-group-2';
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

export const grafanaRulerGroup: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
  name: grafanaRulerGroupName,
  interval: '1m',
  rules: [grafanaRulerRule],
};

export const grafanaRulerGroup2: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
  name: grafanaRulerGroupName2,
  interval: '5m',
  rules: [grafanaRulerRule],
};

export const grafanaRulerEmptyGroup: RulerRuleGroupDTO<RulerGrafanaRuleDTO> = {
  name: 'empty-group',
  interval: '1m',
  rules: [],
};

// AKA Folder
interface GrafanaNamespace {
  name: string;
  uid: string;
}

export class RulerTestDb {
  private namespaces = new Map<string, string>(); // UID -> Name
  private groupsByNamespaceUid = new Map<string, RulerRuleGroupDTO[]>();

  constructor(groups: Iterable<[RulerRuleGroupDTO, GrafanaNamespace]> = []) {
    for (const [group, namespace] of groups) {
      this.addGroup(group, namespace);
    }
  }
  addGroup(group: RulerRuleGroupDTO, namespace: GrafanaNamespace) {
    if (!this.namespaces.has(namespace.uid)) {
      this.namespaces.set(namespace.uid, namespace.name);
    }

    const namespaceGroups = this.groupsByNamespaceUid.get(namespace.uid);
    if (!namespaceGroups) {
      this.groupsByNamespaceUid.set(namespace.uid, [group]);
    } else {
      namespaceGroups.push(group);
    }
  }

  getRulerConfig(): RulerRulesConfigDTO {
    const config: RulerRulesConfigDTO = {};
    for (const [namespaceUid, groups] of this.groupsByNamespaceUid) {
      const namespaceName = this.namespaces.get(namespaceUid);
      if (!namespaceName) {
        throw new Error(`Namespace name for uid ${namespaceUid} not found`);
      }
      config[namespaceName] = groups;
    }
    return config;
  }

  getNamespace(uid: string): RulerRulesConfigDTO | undefined {
    const namespaceGroups = this.groupsByNamespaceUid.get(uid);
    if (!namespaceGroups) {
      return undefined;
    }

    const namespaceName = this.namespaces.get(uid);
    if (!namespaceName) {
      throw new Error(`Namespace name for uid ${uid} not found`);
    }

    return { [namespaceName]: namespaceGroups };
  }

  getGroup(uid: string, groupName: string): RulerRuleGroupDTO | undefined {
    const namespaceGroups = this.groupsByNamespaceUid.get(uid);
    if (!namespaceGroups) {
      return undefined;
    }

    return namespaceGroups.find((group) => group.name === groupName);
  }
}

export const rulerTestDb = new RulerTestDb([
  [grafanaRulerGroup, grafanaRulerNamespace],
  [grafanaRulerGroup2, grafanaRulerNamespace],
  [grafanaRulerEmptyGroup, grafanaRulerNamespace2],
]);

//-------------------- for alert history tests we reuse these constants --------------------
export const time_0 = 1718368710000;
// time1 + 5 seg
export const time_plus_5 = time_0 + 5 * 1000;
// time1 + 15 seg
export const time_plus_15 = time_0 + 15 * 1000;
// time1 + 10 seg
export const time_plus_10 = time_0 + 10 * 1000;
// time1 + 30 seg
export const time_plus_30 = time_0 + 30 * 1000;

// returns 4 transitions. times is an array of 4 timestamps.
export const getHistoryResponse = (times: number[]) => ({
  schema: {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        labels: {},
      },
      {
        name: 'line',
        type: FieldType.other,
        labels: {},
      },
      {
        name: 'labels',
        type: FieldType.other,
        labels: {},
      },
    ],
  },
  data: {
    values: [
      [...times],
      [
        {
          schemaVersion: 1,
          previous: 'Pending',
          current: 'Alerting',
          value: {
            A: 1,
            B: 1,
            C: 1,
          },
          condition: 'C',
          dashboardUID: '',
          panelID: 0,
          fingerprint: '141da2d491f61029',
          ruleTitle: 'alert1',
          ruleID: 7,
          ruleUID: 'adnpo0g62bg1sb',
          labels: {
            alertname: 'alert1',
            grafana_folder: 'FOLDER A',
            handler: '/alerting/*',
          },
        },
        {
          schemaVersion: 1,
          previous: 'Alerting',
          current: 'Normal',
          value: {
            A: 1,
            B: 1,
            C: 1,
          },
          condition: 'C',
          dashboardUID: '',
          panelID: 0,
          fingerprint: '141da2d491f61030',
          ruleTitle: 'alert2',
          ruleID: 3,
          ruleUID: 'adna1xso80hdsd',
          labels: {
            alertname: 'alert2',
            grafana_folder: 'FOLDER A',
            handler: '/alerting/*',
          },
        },
        {
          schemaVersion: 1,
          previous: 'Normal',
          current: 'Pending',
          value: {
            A: 1,
            B: 1,
            C: 1,
          },
          condition: 'C',
          dashboardUID: '',
          panelID: 0,

          fingerprint: '141da2d491f61031',
          ruleTitle: 'alert1',
          ruleID: 7,
          ruleUID: 'adnpo0g62bg1sb',
          labels: {
            alertname: 'alert1',
            grafana_folder: 'FOLDER A',
            handler: '/alerting/*',
          },
        },
        {
          schemaVersion: 1,
          previous: 'Pending',
          current: 'Alerting',
          value: {
            A: 1,
            B: 1,
            C: 1,
          },
          condition: 'C',
          dashboardUID: '',
          panelID: 0,
          fingerprint: '5d438530c73fc657',
          ruleTitle: 'alert2',
          ruleID: 3,
          ruleUID: 'adna1xso80hdsd',
          labels: {
            alertname: 'alert2',
            grafana_folder: 'FOLDER A',
            handler: '/alerting/*',
          },
        },
      ],
      [
        {
          folderUID: 'edlvwh5881z40e',
          from: 'state-history',
          group: 'GROUP111',
          level: 'info',
          orgID: '1',
          service_name: 'unknown_service',
        },
        {
          folderUID: 'edlvwh5881z40e',
          from: 'state-history',
          group: 'GROUP111',
          level: 'info',
          orgID: '1',
          service_name: 'unknown_service',
        },
        {
          folderUID: 'edlvwh5881z40e',
          from: 'state-history',
          group: 'GROUP111',
          level: 'info',
          orgID: '1',
          service_name: 'unknown_service',
        },
        {
          folderUID: 'edlvwh5881z40e',
          from: 'state-history',
          group: 'GROUP111',
          level: 'info',
          orgID: '1',
          service_name: 'unknown_service',
        },
      ],
    ],
  },
});
