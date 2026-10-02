import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { config } from '../../../../config';
import { type BootDataSourceSettings, type DataSourceListSnapshot } from '../types';

// Compares what the MT APIs return with boot data from the same page load, while boot data is
// still sent. Delete this module together with the boot-data source.

const MAX_LISTED = 20;

export interface ListParity {
  bootItems: number;
  missingInMt: string[];
  extraInMt: string[];
  /** `uid:field` for each list field that differs. */
  fieldMismatches: string[];
  defaultMismatch: boolean;
}

/** The boot data the page loaded with. */
export function getBootDataBaseline(): BootDataSourceSettings {
  return {
    // eslint-disable-next-line @grafana/no-config-datasources -- boot data is the parity baseline for the MT fill
    datasources: config.datasources,
    defaultDatasource: config.defaultDatasource,
  };
}

// Boot data leaves the uid off built-ins other than -- Grafana --; the cache uses the name then.
function bootKey(settings: DataSourceInstanceSettings): string {
  return settings.uid || settings.name;
}

export function compareListWithBootData(
  snapshot: DataSourceListSnapshot,
  baseline: BootDataSourceSettings
): ListParity {
  const boot = new Map<string, DataSourceInstanceSettings>();
  let bootDefaultUid: string | undefined;
  for (const settings of Object.values(baseline.datasources)) {
    const key = bootKey(settings);
    boot.set(key, settings);
    if (settings.name === baseline.defaultDatasource || key === baseline.defaultDatasource) {
      bootDefaultUid = key;
    }
  }
  const mt = new Map<string, DataSourceInstanceListItem>(snapshot.items.map((item) => [item.uid, item]));

  const missingInMt = [...boot.keys()].filter((uid) => !mt.has(uid));
  const extraInMt = [...mt.keys()].filter((uid) => !boot.has(uid));
  const fieldMismatches: string[] = [];
  for (const [uid, item] of mt) {
    const settings = boot.get(uid);
    if (!settings) {
      continue;
    }
    if (item.name !== settings.name) {
      fieldMismatches.push(`${uid}:name`);
    }
    if (item.type !== settings.type) {
      fieldMismatches.push(`${uid}:type`);
    }
    if (item.isDefault !== (settings.isDefault ?? false)) {
      fieldMismatches.push(`${uid}:isDefault`);
    }
  }

  return {
    bootItems: boot.size,
    missingInMt,
    extraInMt,
    fieldMismatches,
    defaultMismatch: snapshot.defaultUid !== bootDefaultUid,
  };
}

export function hasListMismatch(parity: ListParity): boolean {
  return (
    parity.missingInMt.length > 0 ||
    parity.extraInMt.length > 0 ||
    parity.fieldMismatches.length > 0 ||
    parity.defaultMismatch
  );
}

/** A Faro context value: at most 20 entries, comma separated. */
export function listForLog(values: string[]): string {
  return values.slice(0, MAX_LISTED).join(',');
}

/**
 * The names of the settings fields that differ from boot data. Values are never returned, and
 * fields that the MT path leaves out on purpose (credentials, `cachingConfig`) are not compared.
 */
export function compareSettingsWithBootData(
  mt: DataSourceInstanceSettings,
  boot: DataSourceInstanceSettings
): string[] {
  const fields: string[] = [];
  if (mt.id !== boot.id) {
    fields.push('id');
  }
  if (mt.access !== boot.access) {
    fields.push('access');
  }
  if (mt.url !== boot.url) {
    fields.push('url');
  }
  if (mt.readOnly !== (boot.readOnly ?? false)) {
    fields.push('readOnly');
  }
  if (mt.database !== boot.database) {
    fields.push('database');
  }
  if (jsonDataKeys(mt) !== jsonDataKeys(boot)) {
    fields.push('jsonData');
  }
  return fields;
}

function jsonDataKeys(settings: DataSourceInstanceSettings): string {
  return Object.keys(settings.jsonData ?? {})
    .sort()
    .join(',');
}

/** The boot-data entry for a uid, or `undefined` when boot data does not have it. */
export function findInBootData(baseline: BootDataSourceSettings, uid: string): DataSourceInstanceSettings | undefined {
  return Object.values(baseline.datasources).find((settings) => bootKey(settings) === uid);
}
