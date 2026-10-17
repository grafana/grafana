/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the document uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. Without a target (or
 * with a dashboard one) the document is the mounted dashboard, so when the top document is a notebook
 * there is no dashboard to enter. A notebook target names the notebook its route renders; one drawn
 * elsewhere (the Assistant canvas) is unsupported.
 */

import {
  onExtensionSidebarClosed,
  setExtensionSidebarFloatingOverride,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { canEnterComposer } from 'app/features/dashboard-scene/composer/composerAccess';
import {
  addComposerEnterRequestListener,
  settleComposerEnterRequest,
  wasComposerEnterRequestDocked,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import {
  type ComposerAPI,
  type ComposerEnterCheck,
  type ComposerNotebookSpec,
  type ComposerSessionAPI,
  type ComposerTarget,
} from 'app/features/dashboard-scene/composer/types';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { canEnterNotebookComposer, getRouteNotebook } from 'app/features/notebook/composer/notebookComposerAccess';
import type { NotebookScene } from 'app/features/notebook/scene/NotebookScene';

import { getMountedDashboardScene, getMountedNotebookScenes } from '../dashboardMutation/dashboardMutationApi';

/** The notebook `uid` names on its route, or why Composer cannot start on it. */
function resolveNotebook(uid: string): { notebook: NotebookScene } | { refusal: ComposerEnterCheck } {
  const route = getRouteNotebook();
  if (route?.isActive && route.state.uid === uid) {
    const check = canEnterNotebookComposer(route, { onRoute: true });
    return check.ok ? { notebook: route } : { refusal: check };
  }
  // Mounted, but not by its route: drawn by a host such as the Assistant canvas.
  const embedded = getMountedNotebookScenes().some((scene) => scene.state.uid === uid);
  return { refusal: { ok: false, reason: embedded ? 'unsupported' : 'no_document' } };
}

/** The mounted dashboard `target` names (or the mounted dashboard when omitted), or why there is none. */
function resolveTarget(target?: ComposerTarget): { scene: DashboardScene } | { refusal: ComposerEnterCheck } {
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
    if (target?.resource === 'notebook') {
      const resolved = resolveNotebook(target.uid);
      return 'refusal' in resolved ? resolved.refusal : { ok: true };
    }
    const resolved = resolveTarget(target);
    return 'refusal' in resolved ? resolved.refusal : canEnterComposer(resolved.scene);
  },
  enter: async (target, { presentation = 'floating' } = {}) => {
    const resolved = target?.resource === 'notebook' ? resolveNotebook(target.uid) : resolveTarget(target);
    const uid = target?.uid ?? getMountedDashboardScene()?.state.uid ?? '';
    if ('refusal' in resolved) {
      settleComposerEnterRequest(uid);
      throw new Error(`Composer is not available: ${resolved.refusal.ok ? 'no_document' : resolved.refusal.reason}`);
    }
    let session: ComposerSessionAPI | ComposerSessionAPI<ComposerNotebookSpec>;
    try {
      if ('notebook' in resolved) {
        // As below: the notebook document pulls in the session and the notebook serializers.
        const { enterNotebookComposer } = await import(
          /* webpackChunkName: "notebook-composer-session" */ 'app/features/notebook/composer/NotebookComposerDocument'
        );
        session = enterNotebookComposer(resolved.notebook);
      } else {
        // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
        const { ComposerSession } = await import(
          /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
        );
        session = ComposerSession.enter(resolved.scene);
      }
    } catch (error) {
      settleComposerEnterRequest(uid);
      throw error;
    }
    // The sidebar is the host's concern, not the session's. Composer is a mode of the Assistant, not a
    // layout: entering floats the sidebar, the user may dock it and stay in Composer, and ending the session
    // brings back the layout from before it, or the user's last choice since. Closing the sidebar ends it.
    // Docked while the picker's request waited: the entry proceeds docked.
    const floating = presentation === 'floating' && !wasComposerEnterRequestDocked(uid);
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
