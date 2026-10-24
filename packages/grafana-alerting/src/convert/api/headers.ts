import { type NotificationSettings, toRulerNotificationSettings } from '../notificationSettings';

/** Options for importing rule groups, sent as `X-Grafana-Alerting-*` headers. */
export interface ConvertRulesOptions {
  /** The data source the rules query. Grafana falls back to its configured default when left out. */
  datasourceUid?: string;
  /** Where recording rules write their results. Defaults to `datasourceUid`. */
  targetDatasourceUid?: string;
  /** The folder namespaces are created in. Defaults to the root folder. */
  folderUid?: string;
  recordingRulesPaused?: boolean;
  alertRulesPaused?: boolean;
  /** Where the imported alert rules send notifications. `null` or left out uses default routing. */
  notificationSettings?: NotificationSettings | null;
  /** Labels added to every imported rule. Keys and values can't be empty or contain `,` or `=`. */
  extraLabels?: Record<string, string>;
  /** A message stored with the rule versions this import creates. At most 500 characters. */
  versionMessage?: string;
  /** Import the rules as editable in the UI instead of marking them as managed by the convert API. */
  disableProvenance?: boolean;
}

/** The folder rule reads and deletes work in. Defaults to the root folder. */
export interface ConvertRulesFolderOptions {
  folderUid?: string;
}

/** Options for importing an Alertmanager config, sent as `X-Grafana-Alerting-*` headers. */
export interface ConvertAlertmanagerOptions {
  /** Names the imported config, and the routing tree it produces. */
  identifier: string;
  /** Replace an existing imported config even when its identifier differs. */
  forceReplace?: boolean;
  /** Check the config without saving it. */
  dryRun?: boolean;
  /** Merge the config into the main Alertmanager config as editable resources instead of keeping it separate. */
  promote?: boolean;
}

/** The headers for a rule import. Only `convertAPI` uses these; they aren't part of the package's exports. */
export function getConvertRulesHeaders(options: ConvertRulesOptions): Record<string, string> {
  const headers: Record<string, string> = { ...getConvertRulesFolderHeaders(options) };

  if (options.datasourceUid) {
    headers['X-Grafana-Alerting-Datasource-UID'] = options.datasourceUid;
  }
  if (options.targetDatasourceUid) {
    headers['X-Grafana-Alerting-Target-Datasource-UID'] = options.targetDatasourceUid;
  }
  if (options.recordingRulesPaused !== undefined) {
    headers['X-Grafana-Alerting-Recording-Rules-Paused'] = String(options.recordingRulesPaused);
  }
  if (options.alertRulesPaused !== undefined) {
    headers['X-Grafana-Alerting-Alert-Rules-Paused'] = String(options.alertRulesPaused);
  }

  const notificationSettings = toRulerNotificationSettings(options.notificationSettings ?? null);
  if (notificationSettings) {
    headers['X-Grafana-Alerting-Notification-Settings'] = JSON.stringify(notificationSettings);
  }

  const extraLabels = Object.entries(options.extraLabels ?? {});
  if (extraLabels.length > 0) {
    headers['X-Grafana-Alerting-Extra-Labels'] = extraLabels.map(([key, value]) => `${key}=${value}`).join(',');
  }
  if (options.versionMessage) {
    headers['X-Grafana-Alerting-Version-Message'] = options.versionMessage;
  }
  // Grafana only checks that this header is present, so any value works.
  if (options.disableProvenance) {
    headers['X-Disable-Provenance'] = 'true';
  }

  return headers;
}

export function getConvertRulesFolderHeaders({ folderUid }: ConvertRulesFolderOptions): Record<string, string> {
  return folderUid ? { 'X-Grafana-Alerting-Folder-UID': folderUid } : {};
}

export function getConvertAlertmanagerHeaders(options: ConvertAlertmanagerOptions): Record<string, string> {
  const headers: Record<string, string> = { 'X-Grafana-Alerting-Config-Identifier': options.identifier };

  if (options.forceReplace) {
    headers['X-Grafana-Alerting-Config-Force-Replace'] = 'true';
  }
  if (options.dryRun) {
    headers['X-Grafana-Alerting-Dry-Run'] = 'true';
  }
  if (options.promote) {
    headers['X-Grafana-Alerting-Promote'] = 'true';
  }

  return headers;
}
