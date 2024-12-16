import { HttpResponse, http } from 'msw';
import { SetupServer } from 'msw/node';

import { FieldType } from '@grafana/data';
import {
  GrafanaAlertStateDecision,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRuleGroupDTO,
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

export const grafanaRulerGroup: RulerRuleGroupDTO = {
  name: grafanaRulerGroupName,
  interval: '1m',
  rules: [grafanaRulerRule],
};

export const grafanaRulerGroup2: RulerRuleGroupDTO = {
  name: grafanaRulerGroupName2,
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
  [grafanaRulerNamespace.uid]: [grafanaRulerGroup, grafanaRulerGroup2],
  [grafanaRulerNamespace2.uid]: [grafanaRulerEmptyGroup],
};

//-------------------- for alert history tests we reuse these constants --------------------
export const time_0 = 1718368710000;
// time1 + 30 seg
export const time_plus_30 = 1718368740000;
// time1 + 5 seg
export const time_plus_5 = 1718368715000;
// time1 + 15 seg
export const time_plus_15 = 1718368725000;
// time1 + 10 seg
export const time_plus_10 = 1718368720000;

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
