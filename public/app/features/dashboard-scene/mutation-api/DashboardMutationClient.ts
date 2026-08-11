/**
 * Dashboard Mutation Client
 *
 * The Mutation API as a dashboard sees it: {@link SceneMutationClient} bound to the dashboard command
 * list. Everything behind the API — dispatch order, permission checks, payload validation, the
 * post-write re-render — lives in the dispatcher and is shared with every other document type. This
 * class only answers "which commands exist on a dashboard".
 */

import type { DashboardScene } from '../scene/DashboardScene';

import { SceneMutationClient } from './SceneMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';

export class DashboardMutationClient extends SceneMutationClient<DashboardScene> {
  constructor(scene: DashboardScene) {
    super(scene, DASHBOARD_COMMANDS);
  }
}
