import { type ReactElement, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertState, mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { usePromRuleSilenceAbility } from '../../hooks/abilities/rules/promRuleAbilities';
import { skipToken } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { useRuleSilenceAbility } from '../../hooks/abilities/rules/rulerRuleAbilities';
import { getRuleUID, prometheusRuleType } from '../../utils/rules';
import SilenceGrafanaRuleDrawer from '../silences/SilenceGrafanaRuleDrawer';

interface Props {
  rule?: CombinedRule;
  instance: Alert;
}

export function AlertInstanceSilenceAction({ rule, instance }: Props): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);

  const rulerSilenceAbility = useRuleSilenceAbility(rule?.rulerRule);
  const grafanaPromRule = prometheusRuleType.grafana.alertingRule(rule?.promRule) ? rule.promRule : skipToken;
  const promSilenceAbility = usePromRuleSilenceAbility(grafanaPromRule);

  const ruleUid = getRuleUID(rule?.rulerRule) ?? getRuleUID(rule?.promRule);
  const baseState = mapStateWithReasonToBaseState(instance.state);
  // NoData/Error alerts reach Alertmanager with rewritten labels (DatasourceNoData/DatasourceError plus
  // a rulename label), so matchers built from the displayed state labels would not silence the notification.
  const labelsMatchNotification = baseState !== GrafanaAlertState.NoData && baseState !== GrafanaAlertState.Error;
  const canSilence = isGranted(rulerSilenceAbility) || isGranted(promSilenceAbility);

  if (!ruleUid || !canSilence || !labelsMatchNotification) {
    return null;
  }

  return (
    <>
      <Button fill="outline" variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        <Trans i18nKey="alerting.alert-instance-silence-action.silence">Silence</Trans>
      </Button>
      {isOpen && (
        <SilenceGrafanaRuleDrawer
          ruleUid={ruleUid}
          instanceLabels={instance.labels}
          title={t('alerting.alert-instance-silence-action.title', 'Silence alert instance')}
          subtitle={t(
            'alerting.alert-instance-silence-action.subtitle',
            'Configure a silence to stop notifications from this alert instance.'
          )}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
