import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { useCanSilenceInFolder, useGrafanaRulesSilenceSupport } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { useFolder } from '../../hooks/useFolder';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { checking, denied, unknown } from './actionReasons';
import { type ActionAvailability } from './ruleActionTypes';

/** Stays "checking" until rule, folder and Alertmanager config load, to avoid flashing enabled to disabled. */
export function useSilenceAvailability(resourceState: RuleResourceState<AlertRule>): ActionAvailability {
  const folderUid = resourceState.rule?.metadata.annotations?.[AnnoKeyFolder];
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const { loading: folderLoading } = useFolder(folderUid);
  const canSilenceInFolder = useCanSilenceInFolder(folderUid);

  if (resourceState.status === 'loading' || silenceLoading || folderLoading) {
    return checking();
  }
  if (resourceState.status === 'error') {
    return unknown();
  }
  if (!silenceSupported) {
    return {
      available: false,
      reason: t(
        'alerting.rule-actions.reason-silence-unsupported',
        'Grafana is configured to send alerts only to external Alertmanagers, which cannot silence this rule here'
      ),
    };
  }
  if (!canSilenceInFolder) {
    return denied();
  }
  return { available: true };
}
