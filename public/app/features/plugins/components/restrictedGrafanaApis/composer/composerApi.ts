/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the document uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. When the top document
 * is a notebook, there is no dashboard to enter.
 */

import { appEvents } from 'app/core/app_events';
import { canEnterComposer } from 'app/features/dashboard-scene/composer/composerAccess';
import {
  addComposerEnterRequestListener,
  settleComposerEnterRequest,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import {
  type ComposerAPI,
  type ComposerEnterCheck,
  type ComposerTarget,
} from 'app/features/dashboard-scene/composer/types';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

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
  onEnterRequested: addComposerEnterRequestListener,
  canEnter: (target) => {
    const resolved = resolveTarget(target);
    return 'refusal' in resolved ? resolved.refusal : canEnterComposer(resolved.scene);
  },
  enter: async (target, { presentation = 'floating' } = {}) => {
    const resolved = resolveTarget(target);
    const uid = target?.uid ?? getMountedDashboardScene()?.state.uid ?? '';
    if ('refusal' in resolved) {
      settleComposerEnterRequest(uid, 'failed');
      throw new Error(`Composer is not available: ${resolved.refusal.ok ? 'no_document' : resolved.refusal.reason}`);
    }
    let session;
    try {
      // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
      const { ComposerSession } = await import(
        /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
      );
      session = ComposerSession.enter(resolved.scene);
    } catch (error) {
      settleComposerEnterRequest(uid, 'failed');
      throw error;
    }
    settleComposerEnterRequest(uid, 'entered');
    // The sidebar is the host's concern, not the session's: float it for this session, then dock it again.
    if (presentation === 'floating') {
      appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'floating' }));
      session.signal.addEventListener(
        'abort',
        () => appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'docked' })),
        { once: true }
      );
    }
    return session;
  },
};
