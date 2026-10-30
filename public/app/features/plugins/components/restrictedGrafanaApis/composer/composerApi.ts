/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the document uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. Without a target (or
 * with a dashboard one) the document is the mounted dashboard, so when the top document is a notebook
 * there is no dashboard to enter. Notebook targets are unsupported for now.
 */

import {
  isExtensionSidebarFloatingOverridden,
  onExtensionSidebarClosed,
  setExtensionSidebarFloatingOverride,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { canEnterComposer } from 'app/features/dashboard-scene/composer/composerAccess';
import {
  addComposerEnterRequestListener,
  settleComposerEnterRequest,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import {
  type ComposerAPI,
  type ComposerEnterCheck,
  type ComposerSessionAPI,
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
  onEnterRequested: addComposerEnterRequestListener,
  canEnter: (target) => {
    const resolved = resolveTarget(target);
    return 'refusal' in resolved ? resolved.refusal : canEnterComposer(resolved.scene);
  },
  enter: async (target, { presentation = 'floating' } = {}) => {
    const resolved = resolveTarget(target);
    const uid = target?.uid ?? getMountedDashboardScene()?.state.uid ?? '';
    if ('refusal' in resolved) {
      settleComposerEnterRequest(uid);
      throw new Error(`Composer is not available: ${resolved.refusal.ok ? 'no_document' : resolved.refusal.reason}`);
    }
    let session: ComposerSessionAPI;
    try {
      // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
      const { ComposerSession } = await import(
        /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
      );
      session = ComposerSession.enter(resolved.scene);
    } catch (error) {
      settleComposerEnterRequest(uid);
      throw error;
    }
    // The sidebar is the host's concern, not the session's. Composer is a mode of the Assistant, not a
    // layout: a sidebar the picker opened floating stays floating, one already open keeps its layout, the
    // user may switch either way and stay in Composer, and ending the session brings back the layout from
    // before it, or the user's last choice since. Closing the sidebar ends it.
    const floating = presentation === 'floating' && isExtensionSidebarFloatingOverridden();
    if (presentation === 'floating') {
      const enteredSession = session;
      if (floating) {
        setExtensionSidebarFloatingOverride(true);
      }
      const stopOnClose = onExtensionSidebarClosed(() => enteredSession.exit());
      session.signal.addEventListener(
        'abort',
        () => {
          stopOnClose();
          setExtensionSidebarFloatingOverride(false);
        },
        { once: true }
      );
    }
    // The session takes the request's override over, so a sidebar the picker floated never docks in between.
    settleComposerEnterRequest(uid, { keepFloating: floating });
    return session;
  },
};
