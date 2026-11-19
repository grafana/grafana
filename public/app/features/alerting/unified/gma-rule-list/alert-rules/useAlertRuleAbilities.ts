import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { type AsyncAbility, Granted, InsufficientPermissions, Loading } from '../../hooks/abilities/types';
import {
  type RuleAbilities,
  type RuleFolderAccess,
  getRuleAbilities,
  useRuleFolderAccess,
} from '../rule-row/ruleAbilities';

export interface AlertRuleAbilities extends RuleAbilities {
  silence: AsyncAbility;
}

export function useAlertRuleAbilities(rule: AlertRule): AlertRuleAbilities {
  const folderAccess = useRuleFolderAccess(rule);
  return { ...getRuleAbilities(rule, folderAccess), silence: getSilenceAbility(folderAccess) };
}

function getSilenceAbility({ data, isLoading }: RuleFolderAccess): AsyncAbility {
  if (isLoading) {
    return Loading;
  }
  const canSilence =
    contextSrv.hasPermission(AccessControlAction.AlertingInstanceCreate) ||
    Boolean(data?.accessControl?.[AccessControlAction.AlertingSilenceCreate]);
  return canSilence
    ? Granted
    : InsufficientPermissions([AccessControlAction.AlertingSilenceCreate, AccessControlAction.AlertingInstanceCreate]);
}
