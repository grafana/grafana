/**
 * Dashboard Mutation Client
 *
 * {@link SceneMutationClient} bound to the dashboard command list. This class only answers "which
 * commands exist on a dashboard"; everything behind the API lives in the dispatcher.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import type { DashboardScene } from '../scene/DashboardScene';

import { SceneMutationClient } from './SceneMutationClient';
import { LAZY_DASHBOARD_COMMANDS } from './commands/lazyRegistry';
import { type LazyMutationCommand } from './commands/types';

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

    super(scene, [...LAZY_DASHBOARD_COMMANDS, ...notebookCommands]);
  }
}
