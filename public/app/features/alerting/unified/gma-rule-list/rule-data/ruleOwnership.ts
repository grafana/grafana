import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyManagerKind } from 'app/features/apiserver/types';

import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';

const PLUGIN_ORIGIN_PREFIX = 'plugin/';

/** The manager kind that stands for the Grafana UI itself, so it never counts as an outside manager. */
const USER_MANAGER_KIND = 'grafana';

/**
 * True when the `__grafana_origin` label marks a rule as plugin-managed. Any other value of the
 * label is an ordinary, user-editable label and gets no plugin treatment.
 */
export function isPluginManaged(labels: Record<string, string> | undefined): boolean {
  return Boolean(labels?.[GRAFANA_ORIGIN_LABEL]?.startsWith(PLUGIN_ORIGIN_PREFIX));
}

/** The plugin id behind a plugin-managed rule's `__grafana_origin` label. */
export function getPluginId(labels: Record<string, string> | undefined): string | undefined {
  return isPluginManaged(labels) ? labels?.[GRAFANA_ORIGIN_LABEL]?.slice(PLUGIN_ORIGIN_PREFIX.length) : undefined;
}

/** The kind of the tool that manages the rule (for example `terraform`), read from the full rule. */
export function getManagerKind(rule: AlertRule | RecordingRule): string | undefined {
  const kind = rule.metadata.annotations?.[AnnoKeyManagerKind];
  return kind && kind !== USER_MANAGER_KIND ? kind : undefined;
}

/** Whether something outside the UI owns the rule, which earns it the provisioning badge. */
export function isProvisionedOrManaged(rule: AlertRule | RecordingRule): boolean {
  return isK8sEntityProvisioned(rule) || getManagerKind(rule) !== undefined;
}
