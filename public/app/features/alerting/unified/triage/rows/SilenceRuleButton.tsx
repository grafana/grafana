import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

import { alertRuleApi } from '../../api/alertRuleApi';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';

interface SilenceRuleButtonProps {
  ruleUID: string;
}

/**
 * Silences a rule straight from the triage list, so you don't have to open the rule and lose the
 * filters you just set up. Renders nothing for someone who isn't allowed to create silences.
 */
export function SilenceRuleButton({ ruleUID }: SilenceRuleButtonProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  // Silencing is granted either across the org or per folder. The org-wide half is a plain
  // permission check that costs nothing, so for most people the button is there immediately and
  // this row never talks to the server.
  const canSilenceOrgWide = isGranted(useGlobalSilenceAbility({ action: SilenceAction.Create }));

  // Only when that isn't enough does it matter which folder the rule is in - and the rule is the
  // only place to get that, since the list is built from metrics that carry the folder's name but
  // not its UID. Skipped entirely for everyone else.
  const { currentData: rulerRule } = alertRuleApi.endpoints.getAlertRule.useQuery(
    canSilenceOrgWide ? skipToken : { uid: ruleUID }
  );
  const canSilenceInFolder = isGranted(
    useGlobalSilenceAbility({ action: SilenceAction.Create, folderUID: rulerRule?.grafana_alert.namespace_uid })
  );

  const handleOpen = useCallback(() => setShowDrawer(true), []);
  const handleClose = useCallback(() => setShowDrawer(false), []);

  if (!canSilenceOrgWide && !canSilenceInFolder) {
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
