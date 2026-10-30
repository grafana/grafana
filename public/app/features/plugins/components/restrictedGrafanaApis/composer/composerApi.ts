/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the document uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. Without a target (or
 * with a dashboard one) the document is the mounted dashboard, so when the top document is a notebook
 * there is no dashboard to enter. Notebook targets are unsupported for now.
 */

import {
  canFloatExtensionSidebar,
  getRequestedExtensionSidebarPresentation,
  onExtensionSidebarClosed,
  resolveExtensionSidebarPresentation,
  setExtensionSidebarFloatingOverride,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';
import type { ComposerSession } from 'app/features/dashboard-scene/composer/ComposerSession';
import {
  canEnterComposer,
  getComposerEnterRefusal,
  type ComposerEnterRefusal,
} from 'app/features/dashboard-scene/composer/composerAccess';
import {
  addComposerEnterRequestListener,
  settleComposerEnterRequest,
  wasComposerEnterRequestDocked,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { type ComposerAPI, type ComposerTarget } from 'app/features/dashboard-scene/composer/types';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { getMountedDashboardScene } from '../dashboardMutation/dashboardMutationApi';

/** The mounted dashboard `target` names (or the mounted dashboard when omitted), or why there is none. */
function resolveTarget(target?: ComposerTarget): { scene: DashboardScene } | { refusal: ComposerEnterRefusal } {
  if (target?.resource === 'notebook') {
    return { refusal: { reason: 'unsupported', detail: 'notebook' } };
  }
  const scene = getMountedDashboardScene();
  if (!scene) {
    return { refusal: { reason: 'no_document', detail: 'not_mounted' } };
  }
  if (target && scene.state.uid !== target.uid) {
    return { refusal: { reason: 'no_document', detail: 'other_document' } };
  }
  return { scene };
}

function refuseEnter(uid: string, { reason, detail }: ComposerEnterRefusal): void {
  settleComposerEnterRequest(uid);
  DashboardInteractions.composerEnterRefused({ dashboard_uid: uid || undefined, reason, detail });
}

/** Whether the user's own sidebar layout, before Composer floats it, is docked. */
function isSidebarDockedByUser(): boolean {
  return (
    resolveExtensionSidebarPresentation(
      getRequestedExtensionSidebarPresentation(),
      canFloatExtensionSidebar(),
      ASSISTANT_PLUGIN_ID
    ) === 'docked'
  );
}

export const composerApi: ComposerAPI = {
  version: 1,
  onEnterRequested: addComposerEnterRequestListener,
  canEnter: (target) => {
    const resolved = resolveTarget(target);
    return 'refusal' in resolved ? { ok: false, reason: resolved.refusal.reason } : canEnterComposer(resolved.scene);
  },
  enter: async (target, { presentation = 'floating' } = {}) => {
    const resolved = resolveTarget(target);
    const uid = target?.uid ?? getMountedDashboardScene()?.state.uid ?? '';
    if ('refusal' in resolved) {
      refuseEnter(uid, resolved.refusal);
      throw new Error(`Composer is not available: ${resolved.refusal.reason}`);
    }
    let session: ComposerSession;
    try {
      // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
      const { ComposerSession } = await import(
        /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
      );
      session = ComposerSession.enter(resolved.scene);
    } catch (error) {
      // A scene that refuses after the check passed, or a session module that fails to load.
      refuseEnter(uid, getComposerEnterRefusal(resolved.scene) ?? { reason: 'unsupported', detail: 'enter_failed' });
      throw error;
    }
    // The sidebar is the host's concern, not the session's. Composer is a mode of the Assistant, not a
    // layout: entering floats the sidebar, the user may dock it and stay in Composer, and ending the session
    // brings back the layout from before it, or the user's last choice since. Closing the sidebar ends it.
    // Docked while the picker's request waited: the entry proceeds docked.
    const floating = presentation === 'floating' && !wasComposerEnterRequestDocked(uid);
    DashboardInteractions.composerSessionStarted({
      dashboard_uid: uid || undefined,
      edit_session_id: resolved.scene.getEditSessionId(),
      composer_session_id: session.sessionId,
      presentation,
      sidebar_was_docked: isSidebarDockedByUser(),
    });
    if (presentation === 'floating') {
      const enteredSession = session;
      if (floating) {
        setExtensionSidebarFloatingOverride(true);
      }
      const stopOnClose = onExtensionSidebarClosed(() => enteredSession.end('sidebar_closed'));
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
