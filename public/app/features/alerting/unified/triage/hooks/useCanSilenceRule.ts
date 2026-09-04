import { skipToken } from '@reduxjs/toolkit/query';

import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { type PromRulesResponse, prometheusApi } from '../../api/prometheusApi';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalSilenceAbility } from '../../hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from '../../hooks/abilities/types';
import { useFolder } from '../../hooks/useFolder';

interface SilencePermission {
  /** True until we can say for certain whether this rule may be silenced. */
  loading: boolean;
  canSilence: boolean;
}

/**
 * Whether the current user may silence a given rule.
 *
 * Silencing is granted either across the org or per folder, and the two halves cost very different
 * things to check. The org-wide half is a plain permission check with no I/O, so most people get an
 * answer without this ever touching the server.
 *
 * Only when that comes back empty does the rule's folder matter, and the triage rows can't supply
 * it - the list is built from metrics carrying the folder's name but not its UID. Rather than look
 * up each rule, we ask for the rules once and share the answer.
 */
export function useCanSilenceRule(ruleUID: string): SilencePermission {
  const canSilenceOrgWide = isGranted(useGlobalSilenceAbility({ action: SilenceAction.Create }));

  // Same query arguments every time, so the cache turns this into a single request however many
  // rules end up asking.
  const rulesQuery = prometheusApi.endpoints.getGrafanaGroups.useQuery(
    canSilenceOrgWide ? skipToken : { limitAlerts: 0 }
  );

  const folderUID = ruleFolderIndex(rulesQuery.currentData)?.get(ruleUID);
  const { loading: folderLoading } = useFolder(canSilenceOrgWide ? undefined : folderUID);
  const canSilenceInFolder = isGranted(useGlobalSilenceAbility({ action: SilenceAction.Create, folderUID }));

  if (canSilenceOrgWide) {
    return { loading: false, canSilence: true };
  }

  return {
    loading: rulesQuery.isUninitialized || rulesQuery.isLoading || (Boolean(folderUID) && folderLoading),
    canSilence: canSilenceInFolder,
  };
}

/**
 * Rule UID to the UID of the folder it lives in.
 *
 * Keyed on the response itself so the index is built once per response rather than once per caller -
 * the cache hands every caller the same object.
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
