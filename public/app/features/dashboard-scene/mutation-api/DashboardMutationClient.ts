/**
 * Dashboard Mutation Client
 *
 * The Mutation API as a dashboard sees it: {@link SceneMutationClient} bound to the dashboard command
 * list. Everything behind the API — dispatch order, permission checks, payload validation, the
 * post-write re-render — lives in the dispatcher and is shared with every other document type. This
 * class only answers "which commands exist on a dashboard".
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
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
    //
    // Gated on the flag as well as by the command's own permission check, because the two answer
    // different questions. The permission check refuses an execute; this decides whether the command is
    // in the list at all — and that list is how a caller discovers what it can do here. Without the
    // gate, an instance with notebooks off still advertises a create-notebook command on every
    // dashboard, which is a tool an agent will offer and then always fail on.
    const notebookCommands = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)
      ? [createNotebookSpecCommand]
      : [];

    super(scene, [...DASHBOARD_COMMANDS, ...notebookCommands]);
  }
}
