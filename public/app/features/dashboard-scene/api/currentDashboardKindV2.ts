import { config } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Status } from '@grafana/schema/src/schema/dashboard/v2';
import { Resource } from 'app/features/apiserver/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

function assertDashboardV2Enabled() {
  const isKubernetesDashboardsEnabled = Boolean(config.featureToggles.kubernetesDashboards);
  const isV2Enabled = Boolean(config.featureToggles.kubernetesDashboardsV2 || config.featureToggles.dashboardNewLayouts);

  if (!isKubernetesDashboardsEnabled || !isV2Enabled) {
    throw new Error('V2 dashboard kinds API requires kubernetes dashboards v2 to be enabled');
  }
}

function getCurrentDashboardScene() {
  const mgr = getDashboardScenePageStateManager();
  const dashboard = mgr.state.dashboard;
  if (!dashboard) {
    throw new Error('No dashboard is currently open');
  }
  return dashboard;
}

/**
 * Returns the currently open dashboard as a v2beta1 Dashboard kind JSON resource.
 *
 * Note: This is intentionally scoped to the current `DashboardScene` only (no lookups by UID).
 */
export function getCurrentDashboardKindV2(): Resource<DashboardV2Spec, Status, 'Dashboard'> {
  assertDashboardV2Enabled();

  const scene = getCurrentDashboardScene();

  // Use the scene’s canonical “save resource” representation to avoid hand-assembling fields.
  const saveResource = scene.getSaveResource({ isNew: !scene.state.uid });
  if (saveResource.apiVersion !== 'dashboard.grafana.app/v2beta1' || saveResource.kind !== 'Dashboard') {
    throw new Error('Current dashboard is not a v2beta1 Dashboard resource');
  }

  const spec = saveResource.spec as unknown;
  if (!isDashboardV2Spec(spec)) {
    throw new Error('Current dashboard is not using schema v2 spec');
  }

  const k8sMeta = scene.state.meta.k8s;
  if (!k8sMeta) {
    throw new Error('Current dashboard is missing Kubernetes metadata');
  }

  return {
    apiVersion: saveResource.apiVersion,
    kind: 'Dashboard',
    metadata: {
      ...k8sMeta,
      // Prefer the metadata coming from the save resource for name/generateName if present.
      name: (saveResource.metadata?.name ?? k8sMeta.name) as string,
      namespace: saveResource.metadata?.namespace ?? k8sMeta.namespace,
      labels: saveResource.metadata?.labels ?? k8sMeta.labels,
      annotations: saveResource.metadata?.annotations ?? k8sMeta.annotations,
    },
    spec,
    // We currently don’t persist/status-sync status in the scene; keep it stable and non-authoritative.
    status: {} as Status,
  };
}


