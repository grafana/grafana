import { isEqual } from 'lodash';

import type { DashboardSceneJsonApiV2 } from '@grafana/runtime';

import { getCurrentDashboardKindV2 as getCurrentDashboardResourceV2 } from './currentDashboardKindV2';
import { applyCurrentDashboardSpecV2 } from './currentDashboardSpecApplyV2';

type DashboardResourceV2 = ReturnType<typeof getCurrentDashboardResourceV2>;

/**
 * The dashboard JSON API is required to be resilient for automation.
 *
 * In practice, the currently loaded `DashboardScene` might temporarily be in a state that cannot be
 * serialized back to a v2 resource (for example, if the scene contains unsupported transformation types).
 *
 * To avoid “bricking” the API in that situation (where both `getCurrentDashboard()` and
 * `applyCurrentDashboard()` would fail because they need to read the current resource),
 * we keep a last-known-good dashboard resource cached as a recovery fallback.
 */
let lastKnownGoodResource: DashboardResourceV2 | undefined;

function getDashboardUidFromUrl(): string | undefined {
  const pathname = globalThis.location?.pathname ?? '';
  // Expected: /d/<uid>/<slug>
  const match = pathname.match(/\/d\/([^/]+)/);
  return match?.[1];
}

function getCurrentDashboardResourceWithFallback(): { resource: DashboardResourceV2; source: 'live' | 'cache' } {
  try {
    const resource = getCurrentDashboardResourceV2();
    lastKnownGoodResource = resource;
    return { resource, source: 'live' };
  } catch (err) {
    if (lastKnownGoodResource) {
      return { resource: lastKnownGoodResource, source: 'cache' };
    }

    const details = err instanceof Error ? err.message : String(err);
    throw new Error(
      'DashboardScene JSON API could not read the current dashboard resource. ' +
        'This can happen if the loaded DashboardScene cannot be serialized to schema v2. ' +
        'To recover, call applyCurrentDashboard() with a valid v2beta1 Dashboard JSON (spec-only changes) ' +
        'whose metadata.name matches the dashboard UID in the URL.\n\n' +
        `Underlying error: ${details}`
    );
  }
}

export const dashboardSceneJsonApiV2: DashboardSceneJsonApiV2 = {
  getCurrentDashboard: (space = 2) => {
    const { resource } = getCurrentDashboardResourceWithFallback();
    return JSON.stringify(resource, null, space);
  },

  applyCurrentDashboard: (resourceJson: string) => {
    const resource = JSON.parse(resourceJson);
    let current: DashboardResourceV2 | undefined;
    try {
      // Prefer live for strict immutability checks, but fall back to cached baseline.
      current = getCurrentDashboardResourceV2();
      lastKnownGoodResource = current;
    } catch {
      current = lastKnownGoodResource;
    }

    // If we can’t read the current resource at all (no cache), we still allow recovery by validating
    // that the caller targets the currently open dashboard, and that the payload is a v2beta1 Dashboard.
    if (!current) {
      const uidFromUrl = getDashboardUidFromUrl();

      if (resource.apiVersion !== 'dashboard.grafana.app/v2beta1') {
        throw new Error('Changing apiVersion is not allowed');
      }
      if (resource.kind !== 'Dashboard') {
        throw new Error('Changing kind is not allowed');
      }
      if (!resource.metadata || typeof resource.metadata !== 'object') {
        throw new Error('Changing metadata is not allowed');
      }
      if (uidFromUrl && resource.metadata.name !== uidFromUrl) {
        throw new Error('Changing metadata is not allowed');
      }
      if (!('status' in resource)) {
        // Keep error message consistent; callers should include status even if empty.
        throw new Error('Changing status is not allowed');
      }

      applyCurrentDashboardSpecV2(resource.spec);
      // Best-effort refresh cache after recovery.
      try {
        lastKnownGoodResource = getCurrentDashboardResourceV2();
      } catch {
        // ignore
      }
      return;
    }

    if (!isEqual(resource.apiVersion, current.apiVersion)) {
      throw new Error('Changing apiVersion is not allowed');
    }
    if (!isEqual(resource.kind, current.kind)) {
      throw new Error('Changing kind is not allowed');
    }
    if (!isEqual(resource.metadata, current.metadata)) {
      throw new Error('Changing metadata is not allowed');
    }
    if (!isEqual(resource.status, current.status)) {
      throw new Error('Changing status is not allowed');
    }

    applyCurrentDashboardSpecV2(resource.spec);
    // Best-effort cache refresh after apply.
    try {
      lastKnownGoodResource = getCurrentDashboardResourceV2();
    } catch {
      // ignore
    }
  },
};


