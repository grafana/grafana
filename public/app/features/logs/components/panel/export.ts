import { groupBy } from 'lodash';
import { parse, stringify } from 'lossless-json';

import { type DataSourceApi, hasLogsLabelTypesSupport, type Labels } from '@grafana/data';
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

function groupLabelsByCategory(log: LogListModel, ds: DataSourceApi): Record<string, LabelEntry[]> | null {
  const labelsWithLinks = labelsObjectToSortedEntries(log.labels);
  if (!labelsWithLinks.length) {
    return null;
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
export function formatGroupedLabelsForJson(groupedLabels: Record<string, LabelEntry[]>) {
  const entries = Object.entries(groupedLabels).filter(([, items]) => items.length > 0);
  const typedCategoryKeys = entries.map(([key]) => key).filter((key) => key !== '');
  if (typedCategoryKeys.length === 0) {
    const pairs: Array<[string, string | unknown]> = [];
    for (const [, items] of entries) {
      for (const { key, value } of items) {
        pairs.push([key, prettifyIfJson(value)]);
      }
    }
    pairs.sort(([a], [b]) => labelKeyCollator.compare(a, b));
    return Object.fromEntries(pairs);
  }
  const nested: Record<string, Record<string, string | unknown>> = {};
  for (const [group, items] of entries) {
    const groupName = group === '' ? 'uncategorized' : group;
    const sorted = [...items].sort((a, b) => labelKeyCollator.compare(a.key, b.key));
    nested[groupName] = Object.fromEntries(sorted.map(({ key, value }) => [key, prettifyIfJson(value)]));
  }
  return nested;
}

function dataframeFieldsToRecord(log: LogListModel): Record<string, string | string[] | unknown> {
  const out: Record<string, string | string[] | unknown> = {};
  for (const field of log.fields) {
    const name = field.keys.join(' | ');
    out[name] = field.values.length === 1 ? prettifyIfJson(field.values[0]) : field.values;
  }
  return out;
}

function prettifyIfJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return raw;
  }
  try {
    return parse(raw) ?? raw;
  } catch {
    return raw;
  }
}

export function buildLogLineFullJsonObject(log: LogListModel, ds: DataSourceApi): Record<string, unknown> {
  void log.body;

  const payload: Record<string, unknown> = {
    timestamp: log.timestamp,
    timeEpochMs: log.timeEpochMs,
    timeEpochNs: log.timeEpochNs,
    timeLocal: log.timeLocal,
    timeUtc: log.timeUtc,
    timeFromNow: log.timeFromNow,
    logLevel: log.logLevel,
    displayLevel: log.displayLevel,
    line: log.isJSON ? prettifyIfJson(log.entry) : log.entry,
  };

  const groupedLabels = groupLabelsByCategory(log, ds);
  if (groupedLabels) {
    const labelsJson = formatGroupedLabelsForJson(groupedLabels);
    payload.labels = labelsJson;
  }

  const fieldsJson = dataframeFieldsToRecord(log);
  if (Object.keys(fieldsJson).length > 0) {
    payload.fields = fieldsJson;
  }

  return payload;
}

export async function getLogAsJSON(log: LogListModel): Promise<string> {
  const ds = await getDataSourceSrv().get(log.datasourceUid);
  return stringify(buildLogLineFullJsonObject(log, ds), null, 2) ?? log.entry;
}
