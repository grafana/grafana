import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyManagerKind } from 'app/features/apiserver/types';

import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';

const PLUGIN_ORIGIN_PREFIX = 'plugin/';

/** The manager kind that stands for the Grafana UI itself, so it never counts as an outside manager. */
const USER_MANAGER_KIND = 'grafana';

export function isPluginManaged(labels: Record<string, string> | undefined): boolean {
  return Boolean(labels?.[GRAFANA_ORIGIN_LABEL]?.startsWith(PLUGIN_ORIGIN_PREFIX));
}

export function getPluginId(labels: Record<string, string> | undefined): string | undefined {
  return isPluginManaged(labels) ? labels?.[GRAFANA_ORIGIN_LABEL]?.slice(PLUGIN_ORIGIN_PREFIX.length) : undefined;
}

/** The labels a row counts and lists: the plugin origin label is left out because the plugin badge shows it. */
export function getDisplayLabels(labels: Record<string, string>): Record<string, string> {
  if (!isPluginManaged(labels)) {
    return labels;
  }
  return Object.fromEntries(Object.entries(labels).filter(([key]) => key !== GRAFANA_ORIGIN_LABEL));
}

/** The kinds the backend derives from legacy provenance, so these rules read as provisioned, not managed. */
const CLASSIC_PROVISIONING_KINDS = new Set(['classic-file-provisioning', 'classic-api-provisioning']);

export function getManagerKind(rule: AlertRule | RecordingRule): string | undefined {
  const kind = rule.metadata.annotations?.[AnnoKeyManagerKind];
  return kind && kind !== USER_MANAGER_KIND ? kind : undefined;
}

/** Set for tool-managed rules (Terraform, Git sync); classic provisioning does not count. */
export function getManagedByKind(rule: AlertRule | RecordingRule): string | undefined {
  const kind = getManagerKind(rule);
  return kind && !CLASSIC_PROVISIONING_KINDS.has(kind) ? kind : undefined;
}

export function isProvisioned(rule: AlertRule | RecordingRule): boolean {
  const kind = getManagerKind(rule);
  return isK8sEntityProvisioned(rule) || (kind !== undefined && CLASSIC_PROVISIONING_KINDS.has(kind));
}

export function isProvisionedOrManaged(rule: AlertRule | RecordingRule): boolean {
  return isProvisioned(rule) || getManagedByKind(rule) !== undefined;
}
