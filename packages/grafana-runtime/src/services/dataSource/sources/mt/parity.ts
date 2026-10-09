import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { config } from '../../../../config';
import { MT_PARITY_MISMATCH_WARNING, MT_SETTINGS_PARITY_MISMATCH_WARNING } from '../../constants';
import { logDataSourceMeasurement, logDataSourceWarning } from '../../logging';
import { DataSourceCacheSourceDecorator } from '../decorator';
import { type BootDataSourceSettings, type DataSourceListSnapshot } from '../types';

// Compares what the MT APIs return with boot data from the same page load, while boot data is
// still sent. Delete this module, and its decorator in selectSource.ts, together with the boot-data
// source.

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
function getBootDataBaseline(): BootDataSourceSettings {
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

function hasListMismatch(parity: ListParity): boolean {
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
function findInBootData(baseline: BootDataSourceSettings, uid: string): DataSourceInstanceSettings | undefined {
  return Object.values(baseline.datasources).find((settings) => bootKey(settings) === uid);
}

/**
 * Compares what the wrapped source returns with boot data, and reports the difference to Faro:
 * a measurement for each list fill and refetch, and warnings that name the differing uids and
 * fields. It never changes what the source returns.
 */
export class BootDataParitySource extends DataSourceCacheSourceDecorator {
  private loggedSettingsMismatch = new Set<string>();

  async loadList(): Promise<DataSourceListSnapshot> {
    const start = performance.now();
    const snapshot = await super.loadList();
    this.compareList(snapshot, getBootDataBaseline(), 'boot', performance.now() - start);
    return snapshot;
  }

  async refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot> {
    const start = performance.now();
    const snapshot = await super.refreshList(payload);
    // The payload DataSourceSrv.reload() fetched is the boot data to compare with. Without it,
    // `config.datasources` would be the outdated boot data from page load.
    if (payload) {
      this.compareList(snapshot, payload, 'reload', performance.now() - start);
    }
    return snapshot;
  }

  async loadSettings(uid: string): Promise<DataSourceInstanceSettings | undefined> {
    const settings = await super.loadSettings(uid);
    if (settings) {
      this.compareSettings(settings);
    }
    return settings;
  }

  private compareList(
    snapshot: DataSourceListSnapshot,
    baseline: BootDataSourceSettings,
    reason: 'boot' | 'reload',
    durationMs: number
  ): void {
    const parity = compareListWithBootData(snapshot, baseline);
    logDataSourceMeasurement(
      'datasource_cache_fill',
      {
        durationMs,
        connections: snapshot.stats?.connections ?? 0,
        items: snapshot.items.length,
        builtIns: snapshot.items.filter((item) => item.meta.builtIn).length,
        droppedMissingPlugin: snapshot.stats?.droppedMissingPlugin ?? 0,
        bootItems: parity.bootItems,
        missingInMt: parity.missingInMt.length,
        extraInMt: parity.extraInMt.length,
        fieldMismatches: parity.fieldMismatches.length,
        defaultMismatch: parity.defaultMismatch ? 1 : 0,
      },
      { reason }
    );
    if (hasListMismatch(parity)) {
      logDataSourceWarning(MT_PARITY_MISMATCH_WARNING, {
        reason,
        missingInMt: listForLog(parity.missingInMt),
        extraInMt: listForLog(parity.extraInMt),
        fieldMismatches: listForLog(parity.fieldMismatches),
      });
    }
  }

  private compareSettings(settings: DataSourceInstanceSettings): void {
    if (this.loggedSettingsMismatch.has(settings.uid)) {
      return;
    }
    // A uid that boot data does not have is already reported by the list comparison.
    const boot = findInBootData(getBootDataBaseline(), settings.uid);
    if (!boot) {
      return;
    }
    const fields = compareSettingsWithBootData(settings, boot);
    if (fields.length > 0) {
      this.loggedSettingsMismatch.add(settings.uid);
      logDataSourceWarning(MT_SETTINGS_PARITY_MISMATCH_WARNING, {
        uid: settings.uid,
        type: settings.type,
        fields: fields.join(','),
      });
    }
  }
}
