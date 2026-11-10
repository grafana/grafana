import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import {
  type Ability,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Provisioned,
} from '../../hooks/abilities/types';
import { type K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export type RuleMetadata = Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;

/**
 * Returns the reason a rule's mutations are locked, or undefined if it is editable.
 * Provisioned, plugin-managed, and externally managed rules are all locked.
 */
export function getLockedReason(rule: RuleMetadata, isPluginManaged: boolean): Ability | undefined {
  if (isK8sEntityProvisioned(rule)) {
    return Provisioned;
  }
  if (isPluginManaged) {
    return IsPluginManaged;
  }
  // Managed by an external system — treat the same as provisioned.
  if (rule.metadata?.annotations?.['grafana.app/managedBy']) {
    return Provisioned;
  }
  return undefined;
}

/**
 * Derives a mutation ability from an access-control annotation.
 * If the rule is locked the lock reason is returned immediately.
 * Otherwise, the annotation value determines whether the action is granted
 * or returns INSUFFICIENT_PERMISSIONS with the required permission.
 */
export function fromAnnotation(
  rule: RuleMetadata,
  locked: Ability | undefined,
  annotation: K8sAnnotations,
  permission: AccessControlAction
): Ability {
  return locked ?? (getAnnotation(rule, annotation) === 'true' ? Granted : InsufficientPermissions([permission]));
}

/** Returns the Duplicate ability, accounting for plugin ownership and create permission. */
export function getDuplicateAbility(isPluginManaged: boolean, canCreate: boolean): Ability {
  if (isPluginManaged) {
    return IsPluginManaged;
  }
  if (!canCreate) {
    return InsufficientPermissions([AccessControlAction.AlertingRuleCreate]);
  }
  return Granted;
}

/** Returns whether the rule spec labels indicate it is plugin-managed. */
export function getIsPluginManaged(rule: RuleMetadata): boolean {
  return Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
}
