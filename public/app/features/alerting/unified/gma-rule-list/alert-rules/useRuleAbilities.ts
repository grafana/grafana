import { useMemo } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useFlagAlertEnrichment, useFlagAlertingEnrichmentPerRule } from '@grafana/runtime/internal';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useEnrichmentAbility } from '../../hooks/abilities/otherAbilities';
import {
  type Ability,
  EnrichmentAction,
  Granted,
  IsPluginManaged,
  NotSupported,
  Provisioned,
} from '../../hooks/abilities/types';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RuleAbilities {
  canEdit: Ability;
  canPause: Ability;
  canDelete: Ability;
  canDuplicate: Ability;
  canSilence: Ability;
  canManageEnrichments: Ability;
}

type RuleMetadata = Pick<AlertRule, 'metadata' | 'spec'>;

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

function getRuleAbilities(rule: RuleMetadata, canCreate: boolean, canManageEnrichmentsAbility: boolean): RuleAbilities {
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
    canSilence: Granted,
    canManageEnrichments: canManageEnrichmentsAbility ? Granted : NotSupported,
  };
}

/** Returns action abilities for a GMA alert rule, memoized on the rule and permission state. */
export function useRuleAbilities(rule: AlertRule): RuleAbilities {
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const canCreate = createSupported && createAllowed;

  const enrichmentReadAbility = useEnrichmentAbility(EnrichmentAction.Read);
  const alertEnrichmentEnabled = useFlagAlertEnrichment();
  const alertingEnrichmentPerRuleEnabled = useFlagAlertingEnrichmentPerRule();
  const canManageEnrichmentsAbility =
    isGranted(enrichmentReadAbility) && alertEnrichmentEnabled && alertingEnrichmentPerRuleEnabled;

  return useMemo(
    () => getRuleAbilities(rule, canCreate, canManageEnrichmentsAbility),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rule.metadata?.annotations, rule.spec?.labels, canCreate, canManageEnrichmentsAbility]
  );
}
