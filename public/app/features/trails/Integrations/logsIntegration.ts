import { lastValueFrom } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { getLogQueryFromMetricsQuery } from 'app/plugins/datasource/loki/queryUtils';

export type RecordingRuleGroup = {
  name: string;
  rules: RecordingRule[];
};

export type RecordingRule = {
  name: string;
  query: string;
  type: 'recording' | 'alerting' | string;
};

export type FoundLokiDataSource = Pick<DataSourceSettings, 'name' | 'uid'>;
export type ExtractedRecordingRule = RecordingRule & { datasource: FoundLokiDataSource };
export type ExtractedRecordingRules = {
  [dataSourceUID: string]: ExtractedRecordingRule[];
};

/**
 * Fetch Loki recording rule groups from the specified datasource.
 *
 * @param datasourceSettings - The settings of the datasource instance.
 * @returns A promise that resolves to an array of recording rule groups.
 */
async function fetchRecordingRuleGroups(datasourceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
  const recordingRuleUrl = `api/prometheus/${datasourceSettings.uid}/api/v1/rules`;
  const recordingRules: BackendSrvRequest = { url: recordingRuleUrl };
  const { data } = await lastValueFrom<
    FetchResponse<{
      data: { groups: RecordingRuleGroup[] };
    }>
  >(getBackendSrv().fetch(recordingRules));

  return data.data.groups;
}

/**
 * Extract recording rules from the provided rule groups and associate them with the given data source.
 *
 * @param ruleGroups - An array of recording rule groups to extract rules from.
 * @param ds - The data source instance settings to associate with the extracted rules.
 * @returns An array of extracted recording rules, each associated with the provided data source.
 */
function extractRecordingRulesFromRuleGroups(
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

/**
 * Retrieve an array of Loki data sources that contain recording rules with the specified metric name.
 *
 * @param metricName - The name of the metric to search for within the recording rules.
 * @param extractedRecordingRules - An object containing extracted recording rules, where each key is a string and the value is an array of recording rules.
 * @returns An array of `FoundLokiDataSource` objects that contain recording rules with the specified metric name.
 */
export function getDataSourcesWithRecordingRulesContainingMetric(
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

/**
 * Generate a Loki query string for a related metric based on the provided metric name, data source ID,
 * and extracted recording rules.
 *
 * @param metricName - The name of the metric for which to generate the Loki query.
 * @param dataSourceUid - The UID of the data source containing the recording rules.
 * @param extractedRecordingRules - An object containing recording rules, indexed by data source UID.
 * @returns The generated Loki query string, or an empty string if the data source UID or metric name is not found.
 */
export function getLokiQueryForRelatedMetric(
  metricName: string,
  dataSourceUid: string,
  extractedRecordingRules: ExtractedRecordingRules
): string {
  if (!dataSourceUid || !extractedRecordingRules[dataSourceUid]) {
    return '';
  }
  const targetRule = extractedRecordingRules[dataSourceUid].find((rule) => rule.name === metricName);
  if (!targetRule) {
    return '';
  }
  const lokiQuery = getLogQueryFromMetricsQuery(targetRule.query);

  return lokiQuery;
}

/**
 * Fetch and extract Loki recording rules from all Loki data sources.
 *
 * @returns {Promise<ExtractedRecordingRules>} A promise that resolves to an object containing
 * the extracted recording rules, keyed by data source UID.
 *
 * @throws Will log an error to the console if fetching or extracting rules fails for any data source.
 */
export async function fetchAndExtractLokiRecordingRules() {
  const lokiDataSources = getDataSourceSrv()
    .getList({ logs: true })
    .filter((ds) => ds.type === 'loki');
  const extractedRecordingRules: ExtractedRecordingRules = {};
  await Promise.all(
    lokiDataSources.map(async (dataSource) => {
      try {
        const ruleGroups: RecordingRuleGroup[] = await fetchRecordingRuleGroups(dataSource);
        const extractedRules = extractRecordingRulesFromRuleGroups(ruleGroups, dataSource);
        extractedRecordingRules[dataSource.uid] = extractedRules;
      } catch (err) {
        console.error(err);
      }
    })
  );

  return extractedRecordingRules;
}
