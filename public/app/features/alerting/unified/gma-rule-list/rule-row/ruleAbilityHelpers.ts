import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { getGlobalRuleAbility } from '../../hooks/abilities/rules/ruleAbilities';
import {
  type Ability,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Provisioned,
  RuleAction,
} from '../../hooks/abilities/types';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export type RuleMetadata = Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;

export interface RuleAbilities {
  edit: Ability;
  pause: Ability;
  delete: Ability;
  duplicate: Ability;
}

/**
 * Pure (non-hook) function that returns all standard rule abilities from metadata alone.
 * Works for both AlertRule and RecordingRule. The silence ability is alert-rule-only
 * and is added on top in useRuleAbilities.
 */
export function getRuleAbilities(rule: RuleMetadata): RuleAbilities {
  const locked = getLockedReason(rule);
  const edit = locked ?? fromAccessAnnotation(rule, K8sAnnotations.AccessWrite, AccessControlAction.AlertingRuleUpdate);

  return {
    edit,
    pause: edit,
    delete: locked ?? fromAccessAnnotation(rule, K8sAnnotations.AccessDelete, AccessControlAction.AlertingRuleDelete),
    // Provisioned rules can still be duplicated; only plugin-owned ones can't.
    duplicate: isPluginManaged(rule) ? IsPluginManaged : getGlobalRuleAbility(RuleAction.Create),
  };
}

function getLockedReason(rule: RuleMetadata): Ability | undefined {
  if (isK8sEntityProvisioned(rule)) {
    return Provisioned;
  }
  if (isPluginManaged(rule)) {
    return IsPluginManaged;
  }
  // Manager kinds without a provenance annotation (e.g. file-provisioning) show up here.
  if (rule.metadata?.annotations?.[AnnoKeyManagerKind]) {
    return Provisioned;
  }
  return undefined;
}

function fromAccessAnnotation(
  rule: RuleMetadata,
  annotation: K8sAnnotations,
  permission: AccessControlAction
): Ability {
  return getAnnotation(rule, annotation) === 'true' ? Granted : InsufficientPermissions([permission]);
}

function isPluginManaged(rule: RuleMetadata): boolean {
  return Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
}
