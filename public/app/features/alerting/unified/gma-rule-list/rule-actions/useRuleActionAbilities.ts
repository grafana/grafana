import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { GRAFANA_ORIGIN_LABEL } from 'app/features/alerting/unified/utils/labels';
import { AccessControlAction } from 'app/types/accessControl';

import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { type ActionAvailability, type RuleActionAbilities } from './ruleActionTypes';

function reasonChecking() {
  return t('alerting.rule-actions.reason-checking', 'Checking permissions...');
}

function reasonUnknown() {
  return t('alerting.rule-actions.reason-unknown', 'Permission unknown');
}

function reasonProvisioned() {
  return t('alerting.rule-actions.reason-provisioned', 'This rule is provisioned and cannot be edited through the UI');
}

function reasonPluginManaged() {
  return t(
    'alerting.rule-actions.reason-plugin-managed',
    'This rule is managed by a plugin and cannot be edited through the UI'
  );
}

function reasonDenied() {
  return t('alerting.rule-actions.reason-denied', 'You do not have permission to do this');
}

const UNAVAILABLE_LOADING: ActionAvailability = { available: false, reason: reasonChecking() };
const UNAVAILABLE_ERROR: ActionAvailability = { available: false, reason: reasonUnknown() };
const UNAVAILABLE_PROVISIONED: ActionAvailability = { available: false, reason: reasonProvisioned() };
const UNAVAILABLE_PLUGIN_MANAGED: ActionAvailability = { available: false, reason: reasonPluginManaged() };
const UNAVAILABLE_DENIED: ActionAvailability = { available: false, reason: reasonDenied() };
const UNAVAILABLE_UNKNOWN: ActionAvailability = { available: false, reason: reasonUnknown() };
const AVAILABLE: ActionAvailability = { available: true };

/**
 * True when the rule's `__grafana_origin` label marks it as owned by a plugin (e.g. an app that
 * provisions its own alert rules) - such rules follow the same read-only treatment as the legacy
 * list gives plugin-provided rules.
 */
function isPluginManagedRule(rule: AlertRule | RecordingRule): boolean {
  const origin = rule.spec.labels?.[GRAFANA_ORIGIN_LABEL];
  return Boolean(origin?.startsWith('plugin/'));
}

/**
 * Gates edit/pause/delete on the server-derived `grafana.com/access/canWrite`/`canDelete`
 * annotations. Only the exact string `"true"` grants the action - a missing annotation means the
 * backend hasn't told us yet (not a denial), so it reads as "unknown" rather than "no".
 */
function capabilityGate(
  annotationValue: string | undefined,
  provisioned: boolean,
  pluginManaged: boolean
): ActionAvailability {
  if (provisioned) {
    return UNAVAILABLE_PROVISIONED;
  }
  if (pluginManaged) {
    return UNAVAILABLE_PLUGIN_MANAGED;
  }
  if (annotationValue === 'true') {
    return AVAILABLE;
  }
  if (annotationValue === undefined) {
    return UNAVAILABLE_UNKNOWN;
  }
  return UNAVAILABLE_DENIED;
}

/**
 * Per-action availability gate for the Alert/Recording rule menus. Deliberately takes the raw
 * resource-fetch state rather than a rule alone, so loading/error states produce a real
 * "unavailable" answer instead of a caller having to remember to check first.
 */
export function useRuleActionAbilities<T extends AlertRule | RecordingRule>(
  resourceState: RuleResourceState<T>
): RuleActionAbilities {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);

  if (resourceState.status === 'loading') {
    return {
      edit: UNAVAILABLE_LOADING,
      pause: UNAVAILABLE_LOADING,
      delete: UNAVAILABLE_LOADING,
      duplicate: UNAVAILABLE_LOADING,
    };
  }
  if (resourceState.status === 'error') {
    return {
      edit: UNAVAILABLE_ERROR,
      pause: UNAVAILABLE_ERROR,
      delete: UNAVAILABLE_ERROR,
      duplicate: UNAVAILABLE_ERROR,
    };
  }

  const { rule } = resourceState;
  const provisioned = isK8sEntityProvisioned(rule);
  const pluginManaged = isPluginManagedRule(rule);
  const canWriteAnnotation = getAnnotation(rule, K8sAnnotations.AccessWrite);
  const canDeleteAnnotation = getAnnotation(rule, K8sAnnotations.AccessDelete);

  // Duplicate is not blocked by provisioning (the copy is a fresh, editable rule) - only by
  // plugin ownership and the create permission.
  function duplicateGate(): ActionAvailability {
    if (pluginManaged) {
      return UNAVAILABLE_PLUGIN_MANAGED;
    }
    return canCreate ? AVAILABLE : UNAVAILABLE_DENIED;
  }
  const duplicate = duplicateGate();

  return {
    edit: capabilityGate(canWriteAnnotation, provisioned, pluginManaged),
    pause: capabilityGate(canWriteAnnotation, provisioned, pluginManaged),
    delete: capabilityGate(canDeleteAnnotation, provisioned, pluginManaged),
    duplicate,
  };
}
