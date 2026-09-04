/**
 * Every Mutation API command, across every document type: `getPayloadSchema` answers for commands that
 * are not currently mounted, so it needs the union of the per-resource lists. Composed here, the
 * app-level wiring for this API, because this is the one module that already sees both features, and
 * kept out of `dashboardMutationApi.ts` so importing the list does not run its factory registration.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import type { MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';
import { DASHBOARD_COMMAND_SCHEMAS } from 'app/features/dashboard-scene/mutation-api/commands/schemaRegistry';
import { NOTEBOOK_COMMANDS } from 'app/features/notebook/mutation-api/registry';

/**
 * Notebook commands are flag-gated for the same reason `DashboardMutationClient` gates them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schemas come from commands with heterogeneous payload and scene types
export function allMutationCommands(): Array<Pick<MutationCommand<any, any>, 'name' | 'payloadSchema'>> {
  const notebookCommands = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)
    ? NOTEBOOK_COMMANDS
    : [];

  return [...DASHBOARD_COMMAND_SCHEMAS, ...notebookCommands];
}
