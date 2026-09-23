/**
 * Dashboard Mutation Client
 *
 * {@link SceneMutationClient} bound to the dashboard command list, plus one dashboard-specific
 * rule: a plan preview is read-only.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { createNotebookSpecCommand } from 'app/features/notebook/mutation-api/commands/createNotebookSpec';

import type { DashboardScene } from '../scene/DashboardScene';

import { SceneMutationClient } from './SceneMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';
import type { MutationRequest, MutationResult } from './types';

const PLANNING_ALLOWED_COMMANDS = new Set(['RENDER_PLAN', 'END_PLANNING']);

export class DashboardMutationClient extends SceneMutationClient<DashboardScene> {
  constructor(scene: DashboardScene) {
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

    super(scene, [...DASHBOARD_COMMANDS, ...notebookCommands]);
  }

  /**
   * A plan preview is not a mutation target: refuses every mutating command except RENDER_PLAN
   * and END_PLANNING. The single point every dashboard command passes through, so a future
   * command is refused without its own guard.
   *
   * Does not add conversation scoping to the mutation API -- a caller still acts on whatever
   * scene is mounted, regardless of conversation. Only closes that gap for a plan preview.
   */
  async execute(mutation: MutationRequest): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();

    if (this.scene.isPlanning() && !PLANNING_ALLOWED_COMMANDS.has(type) && !this.isReadOnly(type)) {
      return {
        success: false,
        error: 'This dashboard is a plan preview and is read-only until it is built or dismissed.',
        changes: [],
      };
    }

    return super.execute(mutation);
  }
}
