import { skipToken } from '@reduxjs/toolkit/query';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useGetFolderAccessQuery } from 'app/api/clients/folder/v1beta1';
import { AnnoKeyFolder, AnnoKeyManagerKind } from 'app/features/apiserver/types';
import { AccessControlAction } from 'app/types/accessControl';

import { getGlobalRuleAbility } from '../../hooks/abilities/rules/ruleAbilities';
import {
  type Ability,
  type AsyncAbility,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Loading,
  Provisioned,
  RuleAction,
} from '../../hooks/abilities/types';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export type RuleMetadata = Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;

export interface RuleAbilities {
  edit: AsyncAbility;
  pause: AsyncAbility;
  delete: AsyncAbility;
  duplicate: Ability;
}

export type RuleFolderAccess = ReturnType<typeof useGetFolderAccessQuery>;

export function useRuleFolderAccess(rule: RuleMetadata): RuleFolderAccess {
  const folderUid = rule.metadata?.annotations?.[AnnoKeyFolder];
  return useGetFolderAccessQuery(folderUid ? { name: folderUid } : skipToken);
}

export function getRuleAbilities(rule: RuleMetadata, folderAccess: RuleFolderAccess): RuleAbilities {
  const locked = getLockedReason(rule);
  const edit = locked ?? fromFolderPermission(folderAccess, AccessControlAction.AlertingRuleUpdate);

  return {
    edit,
    pause: edit,
    delete: locked ?? fromFolderPermission(folderAccess, AccessControlAction.AlertingRuleDelete),
    // Provisioned rules can still be duplicated; only plugin-owned ones can't.
    duplicate: isPluginManaged(rule) ? IsPluginManaged : getGlobalRuleAbility(RuleAction.Create),
  };
}

function getLockedReason(rule: RuleMetadata): Ability | undefined {
  if (isK8sEntityProvisioned(rule)) {
    return Provisioned;
  }
  if (isPluginManaged(rule)) {
    return IsPluginManaged;
  }
  // Manager kinds without a provenance annotation (e.g. file-provisioning) show up here.
  if (rule.metadata?.annotations?.[AnnoKeyManagerKind]) {
    return Provisioned;
  }
  return undefined;
}

function fromFolderPermission(
  { currentData, isFetching }: RuleFolderAccess,
  permission: AccessControlAction
): AsyncAbility {
  if (isFetching) {
    return Loading;
  }
  // The rule editor also requires read access to the rule and its folder, so Edit must not link to a page that refuses.
  const required = [AccessControlAction.AlertingRuleRead, AccessControlAction.FoldersRead, permission];
  return required.every((action) => currentData?.accessControl?.[action])
    ? Granted
    : InsufficientPermissions([permission]);
}

function isPluginManaged(rule: RuleMetadata): boolean {
  return Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
}
