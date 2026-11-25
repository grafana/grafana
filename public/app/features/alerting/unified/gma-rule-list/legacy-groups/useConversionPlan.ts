import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { generatedAPI as rulesAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useGetFolderAccessQuery } from 'app/api/clients/folder/v1beta1';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleDTO, type GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { membershipSearchArg, toMembershipEntries } from '../rule-sequences/ruleSequenceMembership';
import { type RuleKind } from '../shared/ruleKind';

import { planConversion } from './convertGroup';
import { useFindSubfolderQuery } from './legacyGroupsApi';

/** Which rules of the group can move into the subfolder named `title`, and the subfolder if it exists. */
export function useConversionPlan(group: GrafanaPromRuleGroupDTO, title: string, createdFolderUid?: string) {
  const reservedTitle = title.toLowerCase() === 'general';

  const folderAccess = useGetFolderAccessQuery({ name: group.folderUid });
  const subfolder = useFindSubfolderQuery(reservedTitle ? skipToken : { parentUid: group.folderUid, title });
  const targetUid = createdFolderUid ?? subfolder.currentData ?? undefined;
  const targetAccess = useGetFolderAccessQuery(targetUid ? { name: targetUid } : skipToken);

  const alertMembers = useSequenceMembers('alert', group.rules);
  const recordingMembers = useSequenceMembers('recording', group.rules);

  const checking =
    folderAccess.isLoading ||
    subfolder.isLoading ||
    targetAccess.isLoading ||
    alertMembers.isLoading ||
    recordingMembers.isLoading;
  const checkError = folderAccess.error ?? subfolder.error ?? targetAccess.error;

  const plan = useMemo(() => {
    const source = folderAccess.currentData?.accessControl;
    const target = targetAccess.currentData?.accessControl;
    // The rules API checks a folder move as a delete from the source and a create in the target.
    const canMove =
      [
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.FoldersRead,
        AccessControlAction.AlertingRuleDelete,
      ].every((action) => source?.[action]) &&
      (!targetUid || Boolean(target?.[AccessControlAction.AlertingRuleCreate]));
    return planConversion(group, {
      canMove,
      sequenceMembers: new Set([...alertMembers.members, ...recordingMembers.members]),
      sequenceUnknown: new Set([...alertMembers.unknown, ...recordingMembers.unknown]),
    });
  }, [group, folderAccess.currentData, targetAccess.currentData, targetUid, alertMembers, recordingMembers]);

  return { plan, targetUid, reservedTitle, checking, checkError };
}

function useSequenceMembers(kind: RuleKind, rules: GrafanaPromRuleDTO[]) {
  const uids = useMemo(
    () =>
      rules.filter((rule) => (rule.type === PromRuleType.Recording) === (kind === 'recording')).map((rule) => rule.uid),
    [kind, rules]
  );
  const { currentData, isLoading, error } = rulesAPI.useListRuleSequenceSearchV0Alpha1Query(
    uids.length > 0 ? membershipSearchArg(kind, uids) : skipToken
  );
  const members = useMemo(() => {
    // One entry per UID, in order; none when the response is unreadable.
    const entries = toMembershipEntries(kind, uids, currentData);
    return uids.filter((_uid, index) => (entries[index]?.value.items.length ?? 0) > 0);
  }, [kind, uids, currentData]);
  return { members, unknown: error ? uids : [], isLoading };
}
