import { useCallback, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';
import { useRuleLocation } from '../../hooks/useCombinedRule';

interface SilenceRuleButtonProps {
  ruleUID: string;
}

/**
 * Silences a rule straight from the triage list, so you don't have to open the rule and lose the
 * filters you just set up. Renders nothing for someone who isn't allowed to create silences.
 */
export function SilenceRuleButton({ ruleUID }: SilenceRuleButtonProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(() => ({ uid: ruleUID, ruleSourceName: 'grafana' }), [ruleUID]);

  // Silencing can be granted per folder, so we need to know which folder the rule lives in. This is
  // the cheapest way to ask - one small request, which the details sidebar reuses anyway. Someone
  // with the org-wide permission is granted before it even comes back.
  const { result: location } = useRuleLocation(ruleIdentifier);
  const silenceAbility = useGlobalSilenceAbility({
    action: SilenceAction.Create,
    folderUID: location?.namespace,
  });

  const handleOpen = useCallback(() => setShowDrawer(true), []);
  const handleClose = useCallback(() => setShowDrawer(false), []);

  if (!isGranted(silenceAbility)) {
    return null;
  }

  return (
    <>
      <IconButton
        name="bell-slash"
        tooltip={t('alerting.triage.silence-notifications', 'Silence notifications')}
        onClick={handleOpen}
        data-testid={selectors.pages.Alerting.Triage.ruleSilenceButton}
      />
      {showDrawer && <SilenceGrafanaRuleDrawer ruleUid={ruleUID} onClose={handleClose} />}
    </>
  );
}
