import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

export interface RulePermissions {
  canEdit: boolean;
  canPause: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  /** True while the full rule is still loading. All mutation actions are disabled. */
  isLoading: boolean;
}

type Rule = Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;

/**
 * Derives action permissions from the full rule's access-control annotations.
 * While loading, mutation actions (Edit, Pause, Delete) are disabled.
 * After a failed fetch (rule undefined, isLoading false), mutation actions remain
 * hidden but the More menu stays open so View, Duplicate, Copy link, and Silence
 * remain reachable.
 */
export function getRulePermissions(rule: Rule | undefined, isLoading = false): RulePermissions {
  if (isLoading) {
    return { canEdit: false, canPause: false, canDelete: false, canDuplicate: false, isLoading: true };
  }

  if (rule === undefined) {
    // Fetch failed — allow actions that only need the UID (View, Duplicate, Copy link, Silence).
    return { canEdit: false, canPause: false, canDelete: false, canDuplicate: true, isLoading: false };
  }

  const canWrite = getAnnotation(rule, K8sAnnotations.AccessWrite) === 'true';
  const canDelete = getAnnotation(rule, K8sAnnotations.AccessDelete) === 'true';
  const isProvisioned = isK8sEntityProvisioned(rule);
  const isPlugin = !!getRulePluginOrigin({ labels: rule.spec?.labels });
  const isManaged = !!rule.metadata?.annotations?.['grafana.app/managedBy'];
  const restricted = isProvisioned || isPlugin || isManaged;

  return {
    canEdit: canWrite && !restricted,
    canPause: canWrite && !restricted,
    canDelete: canDelete && !restricted,
    canDuplicate: true,
    isLoading: false,
  };
}
