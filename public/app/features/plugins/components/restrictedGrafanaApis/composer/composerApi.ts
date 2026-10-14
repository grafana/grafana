/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the document uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. When the top document
 * is a notebook, there is no dashboard to enter.
 */

import { canEnterComposer } from 'app/features/dashboard-scene/composer/composerAccess';
import {
  type ComposerAPI,
  type ComposerEnterCheck,
  type ComposerTarget,
} from 'app/features/dashboard-scene/composer/types';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { getMountedDashboardScene } from '../dashboardMutation/dashboardMutationApi';

/** The mounted dashboard `target` names (or the mounted dashboard when omitted), or why there is none. */
function resolveTarget(target?: ComposerTarget): { scene: DashboardScene } | { refusal: ComposerEnterCheck } {
  if (target?.resource === 'notebook') {
    return { refusal: { ok: false, reason: 'unsupported' } };
  }
  const scene = getMountedDashboardScene();
  if (!scene || (target && scene.state.uid !== target.uid)) {
    return { refusal: { ok: false, reason: 'no_document' } };
  }
  return { scene };
}

export const composerApi: ComposerAPI = {
  version: 1,
  canEnter: (target) => {
    const resolved = resolveTarget(target);
    return 'refusal' in resolved ? resolved.refusal : canEnterComposer(resolved.scene);
  },
  enter: async (target) => {
    const resolved = resolveTarget(target);
    if ('refusal' in resolved) {
      throw new Error(`Composer is not available: ${resolved.refusal.ok ? 'no_document' : resolved.refusal.reason}`);
    }
    // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
    const { ComposerSession } = await import(
      /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
    );
    return ComposerSession.enter(resolved.scene);
  },
};
