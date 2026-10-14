/**
 * Composer API -- restricted API that lets Grafana Assistant enter Composer on the open document.
 *
 * Only *finding* the dashboard uses the mounted-document stack the Mutation API serves; a session is bound
 * to that scene when it is entered and never writes through the stack afterwards. When the top document
 * is a notebook, there is no dashboard to enter.
 */

import { canEnterComposer } from 'app/features/dashboard-scene/composer/composerAccess';
import { type ComposerAPI } from 'app/features/dashboard-scene/composer/types';

import { getMountedDashboardScene } from '../dashboardMutation/dashboardMutationApi';

export const composerApi: ComposerAPI = {
  version: 1,
  canEnter: () => canEnterComposer(getMountedDashboardScene()),
  enter: async () => {
    // The session pulls in the scene serializers, so it loads on first use rather than with every plugin.
    const { ComposerSession } = await import(
      /* webpackChunkName: "dashboard-composer-session" */ 'app/features/dashboard-scene/composer/ComposerSession'
    );
    return ComposerSession.enter(getMountedDashboardScene());
  },
};
