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
 * While loading (rule === undefined), all mutation actions are disabled.
 * After loading, provisioned, plugin-managed, and externally managed rules
 * have edit/pause/delete disabled regardless of annotations.
 */
export function getRulePermissions(rule: Rule | undefined): RulePermissions {
  if (rule === undefined) {
    return { canEdit: false, canPause: false, canDelete: false, canDuplicate: false, isLoading: true };
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
