import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from 'app/features/alerting/unified/utils/k8s/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { getManagerKind, isPluginManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { checking, denied, managed, pluginManaged, provisioned, unknown } from './actionReasons';
import { type ActionAvailability, type RuleActionAbilities } from './ruleActionTypes';

const AVAILABLE: ActionAvailability = { available: true };

/**
 * Gates edit/pause/delete on the server-derived `grafana.com/access/canWrite`/`canDelete`
 * annotations. Only the exact string `"true"` grants the action - a missing annotation means the
 * backend hasn't told us yet (not a denial), so it reads as "unknown" rather than "no".
 */
function capabilityGate(rule: AlertRule | RecordingRule, annotation: K8sAnnotations): ActionAvailability {
  // A rule that is both provisioned and managed names its manager, which says more than "provisioned".
  const managerKind = getManagerKind(rule);
  if (managerKind) {
    return managed(managerKind);
  }
  if (isK8sEntityProvisioned(rule)) {
    return provisioned();
  }
  if (isPluginManaged(rule.spec.labels)) {
    return pluginManaged();
  }

  const value = getAnnotation(rule, annotation);
  if (value === 'true') {
    return AVAILABLE;
  }
  return value === undefined ? unknown() : denied();
}

/**
 * Duplicate is not blocked by provisioning or a manager (the copy is a fresh, editable rule) -
 * only by plugin ownership and the create permission.
 */
function duplicateGate(rule: AlertRule | RecordingRule): ActionAvailability {
  if (isPluginManaged(rule.spec.labels)) {
    return pluginManaged();
  }
  return ctx.hasPermission(AccessControlAction.AlertingRuleCreate) ? AVAILABLE : denied();
}

/**
 * Per-action availability gate for the Alert/Recording rule menus. Deliberately takes the raw
 * resource-fetch state rather than a rule alone, so loading/error states produce a real
 * "unavailable" answer instead of a caller having to remember to check first.
 */
export function useRuleActionAbilities<T extends AlertRule | RecordingRule>(
  resourceState: RuleResourceState<T>
): RuleActionAbilities {
  if (resourceState.status === 'loading') {
    const reason = checking();
    return { edit: reason, pause: reason, delete: reason, duplicate: reason };
  }
  if (resourceState.status === 'error') {
    const reason = unknown();
    return { edit: reason, pause: reason, delete: reason, duplicate: reason };
  }

  const { rule } = resourceState;
  return {
    edit: capabilityGate(rule, K8sAnnotations.AccessWrite),
    pause: capabilityGate(rule, K8sAnnotations.AccessWrite),
    delete: capabilityGate(rule, K8sAnnotations.AccessDelete),
    duplicate: duplicateGate(rule),
  };
}
