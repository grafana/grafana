import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AccessControlAction } from 'app/types/accessControl';

import { type Ability } from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import {
  fromAnnotation,
  getDuplicateAbility,
  getIsPluginManaged,
  getLockedReason,
} from '../rule-row/ruleAbilityHelpers';

export interface RecordingRuleAbilities {
  edit: Ability;
  pause: Ability;
  delete: Ability;
  duplicate: Ability;
}

export function useRecordingRuleAbilities(rule: RecordingRule): RecordingRuleAbilities {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);

  const isPluginManaged = getIsPluginManaged(rule);
  const locked = getLockedReason(rule, isPluginManaged);

  const edit = fromAnnotation(rule, locked, K8sAnnotations.AccessWrite, AccessControlAction.AlertingRuleUpdate);

  return {
    edit,
    pause: edit,
    delete: fromAnnotation(rule, locked, K8sAnnotations.AccessDelete, AccessControlAction.AlertingRuleDelete),
    duplicate: getDuplicateAbility(isPluginManaged, createSupported && createAllowed),
  };
}
