import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { getAnnotation } from 'app/features/alerting/unified/utils/k8s/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { getManagedByKind, isPluginManaged, isProvisioned } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { checking, denied, managed, pluginManaged, provisioned, unknown } from './actionReasons';
import { type ActionAvailability, type RuleActionAbilities } from './ruleActionTypes';

const AVAILABLE: ActionAvailability = { available: true };

/** Only the exact string `"true"` grants; the backend omits the annotation when the action isn't allowed. */
function capabilityGate(rule: AlertRule | RecordingRule, annotation: K8sAnnotations): ActionAvailability {
  // A rule that is both provisioned and managed names its manager, which says more than "provisioned".
  const managerKind = getManagedByKind(rule);
  if (managerKind) {
    return managed(managerKind);
  }
  if (isProvisioned(rule)) {
    return provisioned();
  }
  if (isPluginManaged(rule.spec.labels)) {
    return pluginManaged();
  }

  return getAnnotation(rule, annotation) === 'true' ? AVAILABLE : denied();
}

/** Provisioning and managers don't block it: the copy is a fresh rule. */
function duplicateGate(rule: AlertRule | RecordingRule): ActionAvailability {
  if (isPluginManaged(rule.spec.labels)) {
    return pluginManaged();
  }
  return ctx.hasPermission(AccessControlAction.AlertingRuleCreate) ? AVAILABLE : denied();
}

/** Takes raw fetch state so loading and error resolve to unavailable without caller checks. */
export function useRuleActionAbilities(
  resourceState: RuleResourceState<AlertRule | RecordingRule>
): RuleActionAbilities {
  if (resourceState.status !== 'loaded') {
    const reason = resourceState.status === 'loading' ? checking() : unknown();
    return { edit: reason, pause: reason, delete: reason, duplicate: reason };
  }

  const { rule } = resourceState;
  const write = capabilityGate(rule, K8sAnnotations.AccessWrite);
  return {
    edit: write,
    pause: write,
    delete: capabilityGate(rule, K8sAnnotations.AccessDelete),
    duplicate: duplicateGate(rule),
  };
}
