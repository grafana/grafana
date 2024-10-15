import { lastValueFrom } from 'rxjs';

import { DataSourceSettings } from '@grafana/data';
import { BackendSrvRequest, FetchResponse, getBackendSrv } from '@grafana/runtime';

export type RecordingRuleGroup = {
  name: string;
  rules: RecordingRule[];
};

export type RecordingRule = {
  name: string;
  query: string;
  type: string; // can be alerting or recording
};

export type FoundLokiDataSource = Pick<DataSourceSettings, 'name' | 'uid'>;
export type ExtractedRecordingRule = RecordingRule & { datasource: FoundLokiDataSource };
export type ExtractedRecordingRules = ExtractedRecordingRule[][];

export async function fetchLokiDataSources(): Promise<DataSourceSettings[]> {
  const dataSourcesReq: BackendSrvRequest = { url: 'api/datasources' };
  const { data } = await lastValueFrom<FetchResponse<DataSourceSettings[]>>(getBackendSrv().fetch(dataSourcesReq));
  return data.filter((d) => d.type === 'loki');
}

export function buildRecordingRuleURL(datasourceSettings: DataSourceSettings): string {
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
  ds: DataSourceSettings
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
  extractedRecordingRules.forEach((recRules) => {
    recRules
      .filter((rr) => rr.name === metricName)
      .forEach((rr) => {
        foundLokiDataSources.push(rr.datasource);
      });
  });

  return foundLokiDataSources;
}

export function fetchLogsForMetric(): string[] {
  return [];
}

export async function fetchAndExtractLokiRecordingRules() {
  const lokiDataSources = await fetchLokiDataSources();
  const extractedRecordingRules: ExtractedRecordingRules = [];
  for (const lokids of lokiDataSources) {
    const url = buildRecordingRuleURL(lokids);
    try {
      const ruleGroups: RecordingRuleGroup[] = await fetchLokiRecordingRules(url);
      const extractedRules = extractRecordingRules(ruleGroups, lokids);
      extractedRecordingRules.push(extractedRules);
    } catch (err) {
      console.error(err);
    }
  }
  return extractedRecordingRules;
}
