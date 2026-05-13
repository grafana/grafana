import { groupBy } from 'lodash';

import {
  DataFrameType,
  type DataSourceApi,
  hasLogsLabelTypesSupport,
  type Labels,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { getLabelTypeFromRow } from '../../utils';

import { type LogListModel } from './processing';

const labelKeyCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

type LabelEntry = { key: string; value: string };

function labelsObjectToSortedEntries(labels: Labels): LabelEntry[] {
  return Object.keys(labels)
    .sort((a, b) => labelKeyCollator.compare(a, b))
    .map((key) => ({ key, value: labels[key] }));
}

function groupLabelsByCategory(log: LogListModel, ds: DataSourceApi): Record<string, LabelEntry[]> {
  const labelsWithLinks = labelsObjectToSortedEntries(log.labels);
  if (!labelsWithLinks.length) {
    return {};
  }
  return groupBy(labelsWithLinks, (label) => {
    if (hasLogsLabelTypesSupport(ds)) {
      return ds.getLabelDisplayTypeFromFrame(label.key, log.dataFrame, log.rowIndex) ?? '';
    }
    return getLabelTypeFromRow(label.key, log, true) ?? '';
  });
}

/**
 * When every label falls into the unnamed bucket (no datasource or no typed categories),
 * export a single flat map. Otherwise export one nested object per category.
 */
export function formatGroupedLabelsForJson(groupedLabels: Record<string, LabelEntry[]>): Record<string, unknown> {
  const entries = Object.entries(groupedLabels).filter(([, items]) => items.length > 0);
  const typedCategoryKeys = entries.map(([k]) => k).filter((k) => k !== '');
  if (typedCategoryKeys.length === 0) {
    const pairs: Array<[string, string]> = [];
    for (const [, items] of entries) {
      for (const { key, value } of items) {
        pairs.push([key, value]);
      }
    }
    pairs.sort(([a], [b]) => labelKeyCollator.compare(a, b));
    return Object.fromEntries(pairs);
  }
  const nested: Record<string, Record<string, string>> = {};
  for (const [group, items] of entries) {
    const groupName = group === '' ? 'uncategorized' : group;
    const sorted = [...items].sort((a, b) => labelKeyCollator.compare(a.key, b.key));
    nested[groupName] = Object.fromEntries(sorted.map(({ key, value }) => [key, value]));
  }
  return nested;
}

function fieldDefsWithoutLinks(log: LogListModel) {
  if (log.dataFrame.meta?.type === DataFrameType.LogLines) {
    return [];
  }
  return log.fields.filter((f) => f.links?.length === 0 && f.fieldIndex !== log.entryFieldIndex).sort();
}

function dataframeFieldsToRecord(log: LogListModel): Record<string, string> {
  const fields = fieldDefsWithoutLinks(log);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const name = f.keys.join(' | ');
    out[name] = f.values.join(' | ');
  }
  return out;
}

export function buildLogLineFullJsonObject(
  log: LogListModel,
  ds: DataSourceApi
): Record<string, unknown> {
  const grouped = groupLabelsByCategory(log, ds);
  const labelsJson = formatGroupedLabelsForJson(grouped);
  const fieldsJson = dataframeFieldsToRecord(log);

  const payload: Record<string, unknown> = {
    timestamp: log.timestamp,
    timeEpochMs: log.timeEpochMs,
    timeEpochNs: log.timeEpochNs,
    timeLocal: log.timeLocal,
    timeUtc: log.timeUtc,
    timeFromNow: log.timeFromNow,
    logLevel: log.logLevel,
    displayLevel: log.displayLevel,
    line: log.entry,
  };

  if (Object.keys(labelsJson).length > 0) {
    payload.labels = labelsJson;
  }

  if (Object.keys(fieldsJson).length > 0) {
    payload.fields = fieldsJson;
  }

  return payload;
}

export async function buildLogLineFullJsonString(log: LogListModel): Promise<string> {
  const ds = await getDataSourceSrv().get(log.datasourceUid);
  return JSON.stringify(buildLogLineFullJsonObject(log, ds), null, 2);
}
