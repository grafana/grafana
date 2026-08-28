import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { type PromRulesResponse, prometheusApi } from '../../api/prometheusApi';
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

  const canSilence = useCanSilenceRule(ruleUID);

  const handleOpen = useCallback(() => setShowDrawer(true), []);
  const handleClose = useCallback(() => setShowDrawer(false), []);

  if (!canSilence) {
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

/**
 * Whether the current user may silence this rule.
 *
 * Silencing is granted either across the org or per folder, and the two halves cost very different
 * things to check. The org-wide half is a plain permission check with no I/O, so most people get an
 * answer without this list touching the server at all.
 *
 * Only when that comes back empty does the rule's folder matter, and the rows can't supply it - the
 * list is built from metrics carrying the folder's name but not its UID. Rather than look up each
 * rule, we ask for the rules once and share the answer across every row.
 */
function useCanSilenceRule(ruleUID: string): boolean {
  const canSilenceOrgWide = isGranted(useGlobalSilenceAbility({ action: SilenceAction.Create }));

  // Same query arguments from every row, so the cache turns this into a single request for the
  // whole page however many rules are on it.
  const { currentData: rules } = prometheusApi.endpoints.getGrafanaGroups.useQuery(
    canSilenceOrgWide ? skipToken : { limitAlerts: 0 }
  );

  const folderUID = ruleFolderIndex(rules)?.get(ruleUID);
  const canSilenceInFolder = isGranted(useGlobalSilenceAbility({ action: SilenceAction.Create, folderUID }));

  return canSilenceOrgWide || canSilenceInFolder;
}

/**
 * Rule UID to the UID of the folder it lives in.
 *
 * Keyed on the response itself so the index is built once per response rather than once per row -
 * the cache hands every row the same object.
 */
const folderIndexes = new WeakMap<object, Map<string, string>>();

function ruleFolderIndex(
  response: PromRulesResponse<GrafanaPromRuleGroupDTO> | undefined
): Map<string, string> | undefined {
  if (!response) {
    return undefined;
  }

  const cached = folderIndexes.get(response);
  if (cached) {
    return cached;
  }

  const index = new Map<string, string>();
  for (const group of response.data.groups) {
    for (const rule of group.rules) {
      if ('uid' in rule && rule.uid) {
        index.set(rule.uid, group.folderUid);
      }
    }
  }
  folderIndexes.set(response, index);

  return index;
}
