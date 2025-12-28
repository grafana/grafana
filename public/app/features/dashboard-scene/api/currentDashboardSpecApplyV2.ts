import { isEqual } from 'lodash';

import { config } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Resource } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { validateDashboardSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

import { getCurrentDashboardKindV2 } from './currentDashboardKindV2';

function assertDashboardV2Enabled() {
  const isKubernetesDashboardsEnabled = Boolean(config.featureToggles.kubernetesDashboards);
  const isV2Enabled = Boolean(config.featureToggles.kubernetesDashboardsV2 || config.featureToggles.dashboardNewLayouts);

  if (!isKubernetesDashboardsEnabled || !isV2Enabled) {
    throw new Error('V2 dashboard kinds API requires kubernetes dashboards v2 to be enabled');
  }
}

function getCurrentSceneOrThrow() {
  const mgr = getDashboardScenePageStateManager();
  const dashboard = mgr.state.dashboard;
  if (!dashboard) {
    throw new Error('No dashboard is currently open');
  }
  return { mgr, dashboard };
}

/**
 * Immediately applies a schema-v2 dashboard spec to the currently open `DashboardScene`.
 *
 * This is a **spec-only** mutation API: it does not allow changing `apiVersion`, `kind`, `metadata`, or `status`.
 */
export function applyCurrentDashboardSpecV2(nextSpec: DashboardV2Spec): void {
  assertDashboardV2Enabled();

  // Validate (throws on error)
  validateDashboardSchemaV2(nextSpec);

  const { mgr, dashboard: currentScene } = getCurrentSceneOrThrow();

  // Only operate on v2 scenes
  const currentModel = currentScene.getSaveModel();
  if (!isDashboardV2Spec(currentModel)) {
    throw new Error('Current dashboard is not using schema v2');
  }

  const currentResource = getCurrentDashboardKindV2();
  const k8sMeta = currentResource.metadata;
  if (!k8sMeta) {
    throw new Error('Current dashboard is missing Kubernetes metadata');
  }

  // Rebuild a new scene from the current immutable wrapper (metadata/access) + new spec.
  // This guarantees the UI updates immediately to match the JSON.
  const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata: k8sMeta,
    spec: nextSpec,
    status: {},
    access: {
      url: currentScene.state.meta.url,
      slug: currentScene.state.meta.slug,
      canSave: currentScene.state.meta.canSave,
      canEdit: currentScene.state.meta.canEdit,
      canDelete: currentScene.state.meta.canDelete,
      canShare: currentScene.state.meta.canShare,
      canStar: currentScene.state.meta.canStar,
      canAdmin: currentScene.state.meta.canAdmin,
      annotationsPermissions: currentScene.state.meta.annotationsPermissions,
      isPublic: currentScene.state.meta.publicDashboardEnabled,
    },
  };

  const nextScene = transformSaveModelSchemaV2ToScene(dto);

  // IMPORTANT: Preserve the *saved baseline* (initialSaveModel) from the currently loaded dashboard,
  // otherwise the change tracker will treat the applied spec as the new baseline and the dashboard
  // won't become saveable (Save button stays non-primary).
  const initialSaveModel = currentScene.getInitialSaveModel();
  const hasBaseline = Boolean(initialSaveModel && isDashboardV2Spec(initialSaveModel));
  if (initialSaveModel && isDashboardV2Spec(initialSaveModel)) {
    nextScene.setInitialSaveModel(initialSaveModel, k8sMeta, 'dashboard.grafana.app/v2beta1');
  }

  // Preserve edit/view mode. Don't force-enter edit mode; that's a UI side effect.
  if (currentScene.state.isEditing) {
    nextScene.onEnterEditMode();
  }

  // Set dirty based on the saved baseline (if present). This prevents the save button from being
  // stuck "blue" when the applied spec matches the baseline.
  const shouldBeDirty = hasBaseline ? !isEqual(nextSpec, initialSaveModel) : true;
  nextScene.setState({ isDirty: shouldBeDirty });

  // Keep cache coherent for the currently open dashboard
  if (currentScene.state.uid) {
    mgr.setSceneCache(currentScene.state.uid, nextScene);
  }

  mgr.setState({ dashboard: nextScene });
}

/**
 * Convenience helper that accepts a full Dashboard kind JSON object, but enforces **spec-only** updates.
 *
 * It rejects any attempt to change `apiVersion`, `kind`, `metadata`, or `status` from the currently open dashboard.
 */
export function applyCurrentDashboardKindV2(resource: Resource<DashboardV2Spec, unknown, 'Dashboard'>): void {
  assertDashboardV2Enabled();

  const current = getCurrentDashboardKindV2();

  if (!isEqual(resource.apiVersion, current.apiVersion)) {
    throw new Error('Changing apiVersion is not allowed');
  }
  if (!isEqual(resource.kind, current.kind)) {
    throw new Error('Changing kind is not allowed');
  }
  if (!isEqual(resource.metadata, current.metadata)) {
    throw new Error('Changing metadata is not allowed');
  }
  if ('status' in resource && !isEqual(resource.status, current.status)) {
    throw new Error('Changing status is not allowed');
  }

  applyCurrentDashboardSpecV2(resource.spec);
}


