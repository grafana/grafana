import { RelativeTimeRange } from '@grafana/data';
import { AlertQuery, Annotations, GrafanaAlertStateDecision, Labels } from 'app/types/unified-alerting-dto';

import { Folder } from '../components/rule-editor/RuleFolderPicker';
import { arrayKeyValuesToObject } from '../utils/labels';

import { alertingApi } from './alertingApi';

export type ResponseLabels = {
  labels: AlertInstances[];
};

export type PreviewResponse = ResponseLabels[];
export interface Datasource {
  type: string;
  uid: string;
}

export const PREVIEW_URL = '/api/v1/rule/test/grafana';
export interface Data {
  refId: string;
  relativeTimeRange: RelativeTimeRange;
  queryType: string;
  datasourceUid: string;
  model: AlertQuery;
}
export interface GrafanaAlert {
  data?: Data;
  condition: string;
  no_data_state: GrafanaAlertStateDecision;
  title: string;
}

export interface Rule {
  grafana_alert: GrafanaAlert;
  for: string;
  labels: Labels;
  annotations: Annotations;
}
export type AlertInstances = Record<string, string>;

export const alertRuleApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    preview: build.mutation<
      PreviewResponse,
      {
        alertQueries: AlertQuery[];
        condition: string;
        folder: Folder;
        customLabels: Array<{
          key: string;
          value: string;
        }>;
        alertName?: string;
        alertUid?: string;
      }
    >({
      query: ({ alertQueries, condition, customLabels, folder, alertName, alertUid }) => ({
        url: PREVIEW_URL,
        data: {
          rule: {
            grafana_alert: {
              data: alertQueries,
              condition: condition,
              no_data_state: 'Alerting',
              title: alertName,
              uid: alertUid ?? 'N/A',
            },
            for: '0s',
            labels: arrayKeyValuesToObject(customLabels),
            annotations: {},
          },
          folderUid: folder.uid,
          folderTitle: folder.title,
        },
        method: 'POST',
      }),
    }),
  }),
});
