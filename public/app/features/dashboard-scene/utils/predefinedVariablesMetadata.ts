import { t } from '@grafana/i18n';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { type DashboardScene } from '../scene/DashboardScene';

import {
  getGlobalVariablesMode,
  parseUseCrossDashboardVariables,
  type ScopeSelection,
} from './crossDashboardVariablesSelection';

/** Current selection annotation value on the live dashboard (meta.k8s is source of truth in the editor). */
export function getPredefinedVariablesAnnotation(dashboard: DashboardScene): string | undefined {
  const fromMeta = dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  if (typeof fromMeta === 'string') {
    return fromMeta;
  }
  const fromSerializer = dashboard.serializer.getK8SMetadata()?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  return typeof fromSerializer === 'string' ? fromSerializer : undefined;
}

/** Whether the selection annotation differs from the edit-session baseline. */
export function hasPredefinedVariablesAnnotationChanges(dashboard: DashboardScene): boolean {
  const initial = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  const current = getPredefinedVariablesAnnotation(dashboard);
  return (initial ?? undefined) !== (current ?? undefined);
}

/** Human-readable label for save-diff UI (metadata is not part of Spec JSON). */
export function formatPredefinedVariablesAnnotationLabel(annotation: string | undefined): string {
  if (annotation === undefined) {
    return t('dashboard-scene.cross-dashboard-variables.label-none', 'None');
  }
  const selection = parseUseCrossDashboardVariables({ [AnnoKeyUseCrossDashboardVariables]: annotation });
  const mode = getGlobalVariablesMode(selection);
  switch (mode) {
    case 'all':
      return t('dashboard-scene.cross-dashboard-variables.label-all', 'All');
    case 'none':
      return t('dashboard-scene.cross-dashboard-variables.label-none', 'None');
    case 'global':
      return t('dashboard-scene.cross-dashboard-variables.label-global', 'Global');
    case 'folder':
      return t('dashboard-scene.cross-dashboard-variables.label-folder', 'Folder');
    default: {
      if (selection === undefined) {
        return t('dashboard-scene.cross-dashboard-variables.label-custom', 'Custom');
      }
      return `${describeScopeSelection(selection.global)} / ${describeScopeSelection(selection.folder)}`;
    }
  }
}

function describeScopeSelection(scope: ScopeSelection): string {
  if (scope === 'all') {
    return t('dashboard-scene.cross-dashboard-variables.label-all', 'All');
  }
  if (scope === 'none') {
    return t('dashboard-scene.cross-dashboard-variables.label-none', 'None');
  }
  return [...scope].sort().join(', ');
}
