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
export type ExtractedRecordingRules = {
  [dataSourceID: string]: ExtractedRecordingRule[];
};

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

function extractLokiQueryFromRecordingRule(rule: ExtractedRecordingRule): string {
  // Remove Unicode escapes and unneeded quotes
  let cleanedRule = rule.query.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace('\\u', ''), 16));
  });
  cleanedRule = cleanedRule
    .replace(/\\"/g, '"') // Replace escaped quotes
    .replace(/^"|"$/g, ''); // Remove starting and ending quotes

  // Extract the Loki query
  const queryRegex = /{[^}]+}.*?(?=\[|$)/;
  const match = cleanedRule.match(queryRegex);
  const extractedQuery = match ? match[0].trim() : '';

  return extractedQuery;
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
  const lokiQuery = extractLokiQueryFromRecordingRule(targetRule);
  return lokiQuery;
}

export function fetchLogsForMetric(): string[] {
  return [];
}

export async function fetchAndExtractLokiRecordingRules() {
  const lokiDataSources = await fetchLokiDataSources();
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
