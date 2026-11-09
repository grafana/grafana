import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import {
  buildSilenceAbility,
  useCanSilenceInFolder,
  useGrafanaRulesSilenceSupport,
} from '../../hooks/abilities/rules/ruleAbilities.utils';
import {
  type Ability,
  type AsyncAbility,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Provisioned,
} from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RuleAbilities {
  edit: Ability;
  pause: Ability;
  delete: Ability;
  duplicate: Ability;
  silence: AsyncAbility;
}

export function useRuleAbilities(rule: AlertRule): RuleAbilities {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(rule.metadata.annotations?.[AnnoKeyFolder]);

  const isPluginManaged = Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
  const locked = getLockedReason(rule, isPluginManaged);

  const fromAnnotation = (annotation: K8sAnnotations, permission: AccessControlAction): Ability =>
    locked ?? (getAnnotation(rule, annotation) === 'true' ? Granted : InsufficientPermissions([permission]));

  const edit = fromAnnotation(K8sAnnotations.AccessWrite, AccessControlAction.AlertingRuleUpdate);

  return {
    edit,
    pause: edit,
    delete: fromAnnotation(K8sAnnotations.AccessDelete, AccessControlAction.AlertingRuleDelete),
    duplicate: getDuplicateAbility(isPluginManaged, createSupported && createAllowed),
    silence: buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder),
  };
}

function getLockedReason(rule: AlertRule, isPluginManaged: boolean): Ability | undefined {
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

function getDuplicateAbility(isPluginManaged: boolean, canCreate: boolean): Ability {
  if (isPluginManaged) {
    return IsPluginManaged;
  }
  if (!canCreate) {
    return InsufficientPermissions([AccessControlAction.AlertingRuleCreate]);
  }
  return Granted;
}
