import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import {
  buildSilenceAbility,
  useCanSilenceInFolder,
  useGrafanaRulesSilenceSupport,
} from '../../hooks/abilities/rules/ruleAbilities.utils';
import { type Ability, type AsyncAbility } from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import {
  fromAnnotation,
  getDuplicateAbility,
  getIsPluginManaged,
  getLockedReason,
} from '../rule-row/ruleAbilityHelpers';

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

  const isPluginManaged = getIsPluginManaged(rule);
  const locked = getLockedReason(rule, isPluginManaged);

  const edit = fromAnnotation(rule, locked, K8sAnnotations.AccessWrite, AccessControlAction.AlertingRuleUpdate);

  return {
    edit,
    pause: edit,
    delete: fromAnnotation(rule, locked, K8sAnnotations.AccessDelete, AccessControlAction.AlertingRuleDelete),
    duplicate: getDuplicateAbility(isPluginManaged, createSupported && createAllowed),
    silence: buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder),
  };
}
