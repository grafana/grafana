import { useMemo } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Ability, Granted, IsPluginManaged, NotSupported, Provisioned } from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RecordingRuleAbilities {
  canEdit: Ability;
  canPause: Ability;
  canDelete: Ability;
  canDuplicate: Ability;
}

type RuleMetadata = Pick<RecordingRule, 'metadata' | 'spec'>;

function writeAbility(isProvisioned: boolean, isPlugin: boolean, isManaged: boolean, canWrite: boolean): Ability {
  if (isProvisioned) {
    return Provisioned;
  }
  if (isPlugin) {
    return IsPluginManaged;
  }
  if (isManaged) {
    return NotSupported;
  }
  return canWrite ? Granted : NotSupported;
}

function duplicateAbility(isPlugin: boolean, canCreate: boolean): Ability {
  if (isPlugin) {
    return IsPluginManaged;
  }
  return canCreate ? Granted : NotSupported;
}

function deleteAbility(isProvisioned: boolean, isPlugin: boolean, isManaged: boolean, canDelete: boolean): Ability {
  if (isProvisioned) {
    return Provisioned;
  }
  if (isPlugin) {
    return IsPluginManaged;
  }
  if (isManaged) {
    return NotSupported;
  }
  return canDelete ? Granted : NotSupported;
}

function getRecordingRuleAbilities(rule: RuleMetadata, canCreate: boolean): RecordingRuleAbilities {
  const canWrite = getAnnotation(rule, K8sAnnotations.AccessWrite) === 'true';
  const canDelete = getAnnotation(rule, K8sAnnotations.AccessDelete) === 'true';
  const isProvisioned = isK8sEntityProvisioned(rule);
  const isPlugin = Boolean(getRulePluginOrigin({ labels: rule.spec?.labels }));
  const isManaged = Boolean(rule.metadata?.annotations?.['grafana.app/managedBy']);

  const write = writeAbility(isProvisioned, isPlugin, isManaged, canWrite);

  return {
    canEdit: write,
    canPause: write,
    canDelete: deleteAbility(isProvisioned, isPlugin, isManaged, canDelete),
    canDuplicate: duplicateAbility(isPlugin, canCreate),
  };
}

/** Returns action abilities for a GMA recording rule, memoized on the rule and permission state. */
export function useRecordingRuleAbilities(rule: RecordingRule): RecordingRuleAbilities {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  return useMemo(
    () => getRecordingRuleAbilities(rule, canCreate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rule.metadata?.annotations, rule.spec?.labels, canCreate]
  );
}
