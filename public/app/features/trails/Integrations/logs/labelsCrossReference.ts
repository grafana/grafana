import { TimeRange, type AdHocVariableFilter } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { findHealthyLokiDataSources, RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';
import { getTrailFor, isAdHocVariable } from '../../utils';

import { createMetricsLogsConnector, type FoundLokiDataSource } from './base';

const knownLabelNameDiscrepancies = {
  job: 'service_name', // `service.name` is `job` in Mimir and `service_name` in Loki
  instance: 'service_instance_id', // `service.instance.id` is `instance` in Mimir and `service_instance_id` in Loki
} as const;

function isLabelNameThatShouldBeReplaced(x: string): x is keyof typeof knownLabelNameDiscrepancies {
  return x in knownLabelNameDiscrepancies;
}

function replaceKnownLabelNames(labelName: string): string {
  if (isLabelNameThatShouldBeReplaced(labelName)) {
    return knownLabelNameDiscrepancies[labelName];
  }

  return labelName;
}

/**
 * Checks if a Loki data source has labels matching the current filters
 */
async function hasMatchingLabels(datasourceUid: string, filters: AdHocVariableFilter[], timeRange?: TimeRange) {
  const ds = await getDataSourceSrv().get(datasourceUid);

  // Get all available label keys for this data source
  const labelKeys = await ds.getTagKeys?.({
    timeRange,
    filters: filters.map(({ key, operator, value }) => ({
      key: replaceKnownLabelNames(key),
      operator,
      value,
    })),
  });

  if (!Array.isArray(labelKeys)) {
    return false;
  }

  const availableLabels = new Set(labelKeys.map((key) => key.text));

  // Early return if none of our filter labels exist in this data source
  const mappedFilterLabels = filters.map((f) => replaceKnownLabelNames(f.key));
  const hasRequiredLabels = mappedFilterLabels.every((label) => availableLabels.has(label));
  if (!hasRequiredLabels) {
    return false;
  }

  // Check if each filter's value exists for its label
  const results = await Promise.all(
    filters.map(async (filter) => {
      const lokiLabelName = replaceKnownLabelNames(filter.key);
      const values = await ds.getTagValues?.({
        key: lokiLabelName,
        timeRange,
        filters,
      });

      if (!Array.isArray(values)) {
        return false;
      }

      return values.some((v) => v.text === filter.value);
    })
  );

  // If any of the filters have no matching values, return false
  return results.every(Boolean);
}

export const createLabelsCrossReferenceConnector = (scene: RelatedLogsScene) => {
  return createMetricsLogsConnector({
    name: 'labelsCrossReference',
    async getDataSources(): Promise<FoundLokiDataSource[]> {
      const trail = getTrailFor(scene);
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);

      if (!isAdHocVariable(filtersVariable) || !filtersVariable.state.filters.length) {
        return [];
      }

      const filters = filtersVariable.state.filters.map(({ key, operator, value }) => ({ key, operator, value }));

      // Get current time range if available
      const timeRange = scene.state.$timeRange?.state.value;

      const lokiDataSources = await findHealthyLokiDataSources();
      const results = await Promise.all(
        lokiDataSources.map(async ({ uid, name }) => {
          const hasLabels = await hasMatchingLabels(uid, filters, timeRange);
          return hasLabels ? { uid, name } : null;
        })
      );

      return results.filter((ds): ds is FoundLokiDataSource => ds !== null);
    },
    getLokiQueryExpr(): string {
      const trail = getTrailFor(scene);
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);

      if (!isAdHocVariable(filtersVariable) || !filtersVariable.state.filters.length) {
        return '';
      }

      const labelValuePairs = filtersVariable.state.filters.map(
        (filter) => `${replaceKnownLabelNames(filter.key)}${filter.operator}"${filter.value}"`
      );

      return `{${labelValuePairs.join(',')}}`; // e.g. `{environment="dev",region="us-west-1"}`
    },
  });
};
