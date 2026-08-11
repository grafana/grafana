/**
 * Dashboard Mutation Client
 *
 * The Mutation API as a dashboard sees it: {@link SceneMutationClient} bound to the dashboard command
 * list. Everything behind the API — dispatch order, permission checks, payload validation, the
 * post-write re-render — lives in the dispatcher and is shared with every other document type. This
 * class only answers "which commands exist on a dashboard".
 */

import { createNotebookSpecCommand } from 'app/features/notebook/mutation-api/commands/createNotebookSpec';

import type { DashboardScene } from '../scene/DashboardScene';

import { SceneMutationClient } from './SceneMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';

export class DashboardMutationClient extends SceneMutationClient<DashboardScene> {
  constructor(scene: DashboardScene) {
    // CREATE_NOTEBOOK_SPEC is the one command from another resource that belongs here. It reads
    // nothing off the scene, and there is no blank notebook to open first, so it has to be reachable
    // from wherever the user already is — which is a dashboard. Registered at this seam rather than in
    // DASHBOARD_COMMANDS so the dashboard registry stays a list of dashboard commands.
    super(scene, [...DASHBOARD_COMMANDS, createNotebookSpecCommand]);
  }
}
