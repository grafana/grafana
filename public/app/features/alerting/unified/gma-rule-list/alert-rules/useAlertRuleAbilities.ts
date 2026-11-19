import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { buildSilenceAbility, useGrafanaRulesSilenceSupport } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { type AsyncAbility } from '../../hooks/abilities/types';
import { type RuleAbilities, getRuleAbilities, useRuleFolderAccess } from '../rule-row/ruleAbilities';

export interface AlertRuleAbilities extends RuleAbilities {
  silence: AsyncAbility;
}

export function useAlertRuleAbilities(rule: AlertRule): AlertRuleAbilities {
  const folderAccess = useRuleFolderAccess(rule);
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilence =
    contextSrv.hasPermission(AccessControlAction.AlertingInstanceCreate) ||
    Boolean(folderAccess.currentData?.accessControl?.[AccessControlAction.AlertingSilenceCreate]);

  return {
    ...getRuleAbilities(rule, folderAccess),
    silence: buildSilenceAbility(silenceLoading || folderAccess.isFetching, silenceSupported, canSilence),
  };
}
