/**
 * Dashboard Mutation Client
 *
 * {@link SceneMutationClient} bound to the dashboard command list. This class only answers "which
 * commands exist on a dashboard"; everything behind the API lives in the dispatcher.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { createNotebookSpecCommand } from 'app/features/notebook/mutation-api/commands/createNotebookSpec';

import type { DashboardScene } from '../scene/DashboardScene';

import { SceneMutationClient } from './SceneMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';
import type { MutationRequest, MutationResult } from './types';

export class DashboardMutationClient extends SceneMutationClient<DashboardScene> {
  constructor(private dashboard: DashboardScene) {
    // CREATE_NOTEBOOK_SPEC reads nothing off the scene and there is no blank notebook to open first, so
    // it has to be reachable from wherever the user already is. Registered at this seam rather than in
    // DASHBOARD_COMMANDS so the dashboard registry stays a list of dashboard commands.
    //
    // Flag-gated as well as permission-checked because the two answer different questions: the
    // permission check refuses an execute, while this decides whether the command is in the list a
    // caller discovers from at all. Without the gate an instance with notebooks off advertises a create
    // an agent will offer and then always fail on.
    const notebookCommands = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)
      ? [createNotebookSpecCommand]
      : [];

    super(dashboard, [...DASHBOARD_COMMANDS, ...notebookCommands]);
  }
  async execute(mutation: MutationRequest): Promise<MutationResult> {
    if (mutation.planId !== undefined && this.dashboard.state.planning?.planId !== mutation.planId) {
      return { success: false, changes: [], error: 'The preview dashboard is no longer open.' };
    }
    return super.execute(mutation);
  }
}
