import { AnnoKeyUseCrossDashboardVariables, type ObjectMeta } from 'app/features/apiserver/types';

import {
  parseUseCrossDashboardVariables,
  writeUseCrossDashboardVariables,
  type UseCrossDashboardVariables,
} from './crossDashboardVariablesSelection';

/**
 * Narrow host so the sidebar pane and Mutation API share one write path without
 * the pane importing DashboardScene (circular dep).
 */
export type CrossDashboardVariablesHost = {
  state: {
    meta: {
      k8s?: Partial<ObjectMeta>;
    };
  };
  serializer: {
    getK8SMetadata: () => Partial<ObjectMeta> | undefined;
    setK8SAnnotations: (annotations: Record<string, string>) => void;
  };
  setState: (state: { meta: { k8s?: Partial<ObjectMeta> } }) => void;
  refreshPredefinedVariables: () => Promise<void>;
};

/** Merge serializer + live meta annotations; meta.k8s wins in the editor. */
export function readUseCrossDashboardVariablesAnnotations(
  dashboard: CrossDashboardVariablesHost
): Record<string, string> {
  const fromMeta = dashboard.state.meta.k8s?.annotations ?? {};
  const fromSerializer = dashboard.serializer.getK8SMetadata()?.annotations ?? {};
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...fromSerializer, ...fromMeta })) {
    if (typeof value === 'string') {
      merged[key] = value;
    }
  }
  return merged;
}

export function parseUseCrossDashboardVariablesFromHost(
  dashboard: CrossDashboardVariablesHost
): UseCrossDashboardVariables | undefined {
  const annotationValue = dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  if (typeof annotationValue === 'string') {
    return parseUseCrossDashboardVariables({ [AnnoKeyUseCrossDashboardVariables]: annotationValue });
  }
  return parseUseCrossDashboardVariables(readUseCrossDashboardVariablesAnnotations(dashboard));
}

/**
 * Write or delete `grafana.app/useCrossDashboardVariables` on the live dashboard
 * and re-inject predefined variables. Both scopes `"none"` omit the annotation.
 */
export function persistUseCrossDashboardVariables(
  dashboard: CrossDashboardVariablesHost,
  selection: UseCrossDashboardVariables
): Promise<void> {
  const meta = dashboard.state.meta;
  const annotations = readUseCrossDashboardVariablesAnnotations(dashboard);
  writeUseCrossDashboardVariables(annotations, selection);

  const nextMetaK8s: Partial<ObjectMeta> = {
    ...(meta.k8s ?? {}),
    annotations,
  };

  dashboard.serializer.setK8SAnnotations(annotations);

  // Changing meta triggers the change tracker; hasMetadataChanges includes this annotation
  // so Save stays enabled until the dashboard is saved (or discarded).
  dashboard.setState({
    meta: {
      ...meta,
      k8s: nextMetaK8s,
    },
  });

  return dashboard.refreshPredefinedVariables();
}
