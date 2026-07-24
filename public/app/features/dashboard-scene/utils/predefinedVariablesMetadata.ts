import {
  AnnoKeyIgnorePredefinedVariables,
  DENY_ALL_FOLDER_PREDEFINED,
  DENY_ALL_GLOBAL_PREDEFINED,
  DENY_ALL_PREDEFINED,
} from 'app/features/apiserver/types';

import { type DashboardScene } from '../scene/DashboardScene';

import { parseIgnorePredefinedVariables } from './predefinedVariableDenyList';

/** Current denylist annotation value on the live dashboard (meta.k8s is source of truth in the editor). */
export function getPredefinedVariablesAnnotation(dashboard: DashboardScene): string | undefined {
  const fromMeta = dashboard.state.meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
  if (typeof fromMeta === 'string') {
    return fromMeta;
  }
  const fromSerializer = dashboard.serializer.getK8SMetadata()?.annotations?.[AnnoKeyIgnorePredefinedVariables];
  return typeof fromSerializer === 'string' ? fromSerializer : undefined;
}

/** Whether the denylist annotation differs from the edit-session baseline. */
export function hasPredefinedVariablesAnnotationChanges(dashboard: DashboardScene): boolean {
  const initial = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
  const current = getPredefinedVariablesAnnotation(dashboard);
  return (initial ?? undefined) !== (current ?? undefined);
}

/** Human-readable label for save-diff UI (metadata is not part of Spec JSON). */
export function formatPredefinedVariablesAnnotationLabel(annotation: string | undefined): string {
  if (annotation === undefined) {
    return 'All';
  }
  const denyList = parseIgnorePredefinedVariables({ [AnnoKeyIgnorePredefinedVariables]: annotation });
  if (denyList === undefined || denyList.length === 0) {
    return 'All';
  }
  if (denyList.includes(DENY_ALL_PREDEFINED)) {
    return 'None';
  }
  if (denyList.length === 1 && denyList[0] === DENY_ALL_FOLDER_PREDEFINED) {
    return 'Global';
  }
  if (denyList.length === 1 && denyList[0] === DENY_ALL_GLOBAL_PREDEFINED) {
    return 'Folder';
  }
  return 'Custom';
}
