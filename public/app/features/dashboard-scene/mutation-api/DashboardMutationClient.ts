/**
 * Dashboard Mutation Client
 *
 * {@link SceneMutationClient} bound to the dashboard command list, plus one dashboard-specific
 * rule: a plan preview is read-only.
 */

import { isEqual } from 'lodash';

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { PENDING_CHANGES_COMMANDS, isPendingChangesEnabled } from '../lifecycle/pendingChangesFlag';
import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardModesEnabled, isComposerMode, isViewingDashboard } from '../scene/dashboardModes';
import type { DashboardSceneState } from '../scene/types/dashboard';

import { SceneMutationClient } from './SceneMutationClient';
import { LAZY_DASHBOARD_COMMANDS } from './commands/lazyRegistry';
import { type LazyMutationCommand } from './commands/types';
import type { MutationRequest, MutationResult } from './types';

const PLANNING_ALLOWED_COMMANDS = new Set(['RENDER_PLAN', 'END_PLANNING']);

export class DashboardMutationClient extends SceneMutationClient<DashboardScene> {
  constructor(scene: DashboardScene) {
    // CREATE_NOTEBOOK_SPEC reads nothing off the scene and there is no blank notebook to open first, so
    // it has to be reachable from wherever the user already is. Registered at this seam rather than in
    // LAZY_DASHBOARD_COMMANDS so the dashboard registry stays a list of dashboard commands.
    //
    // Flag-gated as well as permission-checked because the two answer different questions: the
    // permission check refuses an execute, while this decides whether the command is in the list a
    // caller discovers from at all. Without the gate an instance with notebooks off advertises a create
    // an agent will offer and then always fail on.
    const notebookCommands: Array<LazyMutationCommand<DashboardScene>> = getFeatureFlagClient().getBooleanValue(
      FlagKeys.DashboardNotebooks,
      false
    )
      ? [
          {
            name: 'CREATE_NOTEBOOK_SPEC',
            load: () =>
              import('app/features/notebook/mutation-api/commands/createNotebookSpec').then(
                (module) => module.createNotebookSpecCommand
              ),
          },
        ]
      : [];

    // Pending changes commands exist only with the pending changes flag on, like their schemas.
    const dashboardCommands = isPendingChangesEnabled()
      ? LAZY_DASHBOARD_COMMANDS
      : LAZY_DASHBOARD_COMMANDS.filter((command) => !PENDING_CHANGES_COMMANDS.has(command.name));
    super(scene, [...dashboardCommands, ...notebookCommands]);
  }

  public getScene(): DashboardScene {
    return this.scene;
  }

  /**
   * A plan preview is not a mutation target: refuses every mutating command except RENDER_PLAN
   * and END_PLANNING. The single point every dashboard command passes through, so a future
   * command is refused without its own guard.
   *
   * A building screen is the exception: the build's first write replaces it. The write runs with
   * the loading screen still up and planning ends once it lands, so the screen gives way
   * straight to the result instead of to an empty dashboard while the write is applied.
   *
   * Does not add conversation scoping to the mutation API -- a caller still acts on whatever
   * scene is mounted, regardless of conversation. Only closes that gap for a plan preview.
   */
  async execute(mutation: MutationRequest, callerPluginId?: string): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();

    let building: DashboardSceneState['planning'];
    if (this.scene.isPlanning() && !PLANNING_ALLOWED_COMMANDS.has(type) && !this.isReadOnly(type)) {
      const { planning } = this.scene.state;
      if (planning?.phase !== 'building') {
        return {
          success: false,
          error: 'This dashboard is a plan preview and is read-only until it is built or dismissed.',
          changes: [],
        };
      }
      building = planning;
    }

    const checkWrite = () =>
      dashboardModesEnabled() &&
      (isViewingDashboard(this.scene.state) || isComposerMode(this.scene.state)) &&
      callerPluginId !== 'grafana-assistant-app' &&
      !PLANNING_ALLOWED_COMMANDS.has(type)
        ? 'Only Grafana Assistant can edit a dashboard in View mode. Select Editing to edit manually.'
        : undefined;
    const result = await super.executeChecked(
      mutation,
      checkWrite,
      callerPluginId === 'grafana-assistant-app' ? (write) => this.scene.withAssistantWrite(write) : undefined
    );
    // Some commands update child scenes directly rather than publishing undoable actions.
    if (
      result.success &&
      !this.isReadOnly(type) &&
      !PLANNING_ALLOWED_COMMANDS.has(type) &&
      type !== 'ENTER_EDIT_MODE' &&
      type !== 'CREATE_NOTEBOOK_SPEC' &&
      result.changes.some(({ previousValue, newValue }) => !isEqual(previousValue, newValue))
    ) {
      this.scene.recordEditMutation(callerPluginId === 'grafana-assistant-app' ? 'assistant' : 'user');
    }
    // Only a write that landed replaces the building screen: a rejected one leaves an empty dashboard
    // behind it while the build retries. A concurrent write that landed first has already ended it,
    // and END_PLANNING ends it if the build never lands one.
    if (building && result.success && this.scene.state.planning === building) {
      this.scene.setState({ planning: undefined });
    }
    return result;
  }
}
