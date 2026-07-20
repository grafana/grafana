import {
  ALLOW_ALL_FOLDER_PREDEFINED,
  ALLOW_ALL_GLOBAL_PREDEFINED,
  ALLOW_ALL_PREDEFINED,
  AnnoKeyUsePredefinedVariables,
} from 'app/features/apiserver/types';

import { type DashboardScene } from '../scene/DashboardScene';

import { parseUsePredefinedVariables } from './predefinedVariableAllowList';

/** Current allowlist annotation value on the live dashboard (meta.k8s is source of truth in the editor). */
export function getPredefinedVariablesAnnotation(dashboard: DashboardScene): string | undefined {
  const fromMeta = dashboard.state.meta.k8s?.annotations?.[AnnoKeyUsePredefinedVariables];
  if (typeof fromMeta === 'string') {
    return fromMeta;
  }
  const fromSerializer = dashboard.serializer.getK8SMetadata()?.annotations?.[AnnoKeyUsePredefinedVariables];
  return typeof fromSerializer === 'string' ? fromSerializer : undefined;
}

/** Whether the allowlist annotation differs from the edit-session baseline. */
export function hasPredefinedVariablesAnnotationChanges(dashboard: DashboardScene): boolean {
  const initial = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyUsePredefinedVariables];
  const current = getPredefinedVariablesAnnotation(dashboard);
  return (initial ?? undefined) !== (current ?? undefined);
}

/** Human-readable label for save-diff UI (metadata is not part of Spec JSON). */
export function formatPredefinedVariablesAnnotationLabel(annotation: string | undefined): string {
  if (annotation === undefined) {
    return 'Not set';
  }
  const config = parseUsePredefinedVariables({ [AnnoKeyUsePredefinedVariables]: annotation });
  if (config === undefined) {
    return 'Not set';
  }
  const list = config.predefinedVariablesAllowList;
  if (list === ALLOW_ALL_PREDEFINED || (Array.isArray(list) && list.includes(ALLOW_ALL_PREDEFINED))) {
    return 'All';
  }
  if (Array.isArray(list) && list.length === 1 && list[0] === ALLOW_ALL_GLOBAL_PREDEFINED) {
    return 'Global';
  }
  if (Array.isArray(list) && list.length === 1 && list[0] === ALLOW_ALL_FOLDER_PREDEFINED) {
    return 'Folder';
  }
  if (Array.isArray(list) && list.length === 0) {
    return 'None';
  }
  return 'Custom';
}
