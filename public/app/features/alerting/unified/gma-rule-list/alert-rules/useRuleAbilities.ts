import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import {
  buildSilenceAbility,
  useCanSilenceInFolder,
  useGrafanaRulesSilenceSupport,
} from '../../hooks/abilities/rules/ruleAbilities.utils';
import { type AsyncAbility } from '../../hooks/abilities/types';
import { type RuleAbilities, getRuleAbilities } from '../rule-row/ruleAbilityHelpers';

export interface RuleAbilitiesWithSilence extends RuleAbilities {
  silence: AsyncAbility;
}

export function useRuleAbilities(rule: AlertRule): RuleAbilitiesWithSilence {
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(rule.metadata.annotations?.[AnnoKeyFolder]);

  return {
    ...getRuleAbilities(rule),
    silence: buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder),
  };
}
