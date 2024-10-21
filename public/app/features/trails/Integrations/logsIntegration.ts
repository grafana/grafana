import { lastValueFrom } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { getBackendSrv, type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getLogQueryFromMetricsQuery } from 'app/plugins/datasource/loki/queryUtils';

export type RecordingRuleGroup = {
  name: string;
  rules: RecordingRule[];
};

export type RecordingRule = {
  name: string;
  query: string;
  type: 'recording' | 'alerting';
};

export type FoundLokiDataSource = Pick<DataSourceSettings, 'name' | 'uid'>;
export type ExtractedRecordingRule = RecordingRule & { datasource: FoundLokiDataSource };
export type ExtractedRecordingRules = {
  [dataSourceUID: string]: ExtractedRecordingRule[];
};

export function buildRecordingRuleURL(datasourceSettings: DataSourceInstanceSettings<DataSourceJsonData>): string {
  return `api/prometheus/${datasourceSettings.uid}/api/v1/rules`;
}

export async function fetchLokiRecordingRules(url: string) {
  const recordingRules: BackendSrvRequest = { url };
  const { data } = await lastValueFrom<
    FetchResponse<{
      data: { groups: RecordingRuleGroup[] };
    }>
  >(getBackendSrv().fetch(recordingRules));
  return data.data.groups;
}

export function extractRecordingRules(
  ruleGroups: RecordingRuleGroup[],
  ds: DataSourceInstanceSettings<DataSourceJsonData>
): ExtractedRecordingRule[] {
  if (ruleGroups.length === 0) {
    return [];
  }

  const extractedRules: ExtractedRecordingRule[] = [];
  ruleGroups.forEach((rg) => {
    rg.rules
      .filter((r) => r.type === 'recording')
      .forEach(({ type, name, query }) => {
        extractedRules.push({
          type,
          name,
          query,
          datasource: {
            name: ds.name,
            uid: ds.uid,
          },
        });
      });
  });

  return extractedRules;
}

export function getLogsUidOfMetric(
  metricName: string,
  extractedRecordingRules: ExtractedRecordingRules
): FoundLokiDataSource[] {
  const foundLokiDataSources: FoundLokiDataSource[] = [];
  Object.values(extractedRecordingRules).forEach((recRules) => {
    recRules
      .filter((rr) => rr.name === metricName)
      .forEach((rr) => {
        foundLokiDataSources.push(rr.datasource);
      });
  });

  return foundLokiDataSources;
}

export function getLogsQueryForMetric(
  metricName: string,
  dataSourceId: string,
  extractedRecordingRules: ExtractedRecordingRules
): string {
  if (!dataSourceId || !extractedRecordingRules[dataSourceId]) {
    return '';
  }
  const targetRule = extractedRecordingRules[dataSourceId].find((rule) => rule.name === metricName);
  if (!targetRule) {
    return '';
  }
  const lokiQuery = getLogQueryFromMetricsQuery(targetRule.query);

  return lokiQuery;
}

export function fetchLogsForMetric(): string[] {
  return [];
}

export async function fetchAndExtractLokiRecordingRules() {
  const lokiDataSources = getDatasourceSrv()
    .getList({ logs: true })
    .filter((ds) => ds.type === 'loki');
  const extractedRecordingRules: ExtractedRecordingRules = {};
  for (const lokids of lokiDataSources) {
    const url = buildRecordingRuleURL(lokids);
    try {
      const ruleGroups: RecordingRuleGroup[] = await fetchLokiRecordingRules(url);
      const extractedRules = extractRecordingRules(ruleGroups, lokids);
      extractedRecordingRules[lokids.uid] = extractedRules;
    } catch (err) {
      console.error(err);
    }
  }
  return extractedRecordingRules;
}
