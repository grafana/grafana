/**
 * Every Mutation API command, across every document type: `getPayloadSchema` answers for commands that
 * are not currently mounted, so it needs the union of the per-resource lists. Composed here, the
 * app-level wiring for this API, because this is the one module that already sees both features, and
 * kept out of `dashboardMutationApi.ts` so importing the list does not run its factory registration.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { DASHBOARD_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import type { MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';
import { NOTEBOOK_COMMANDS } from 'app/features/notebook/mutation-api/registry';

/**
 * A function, not a module-level array, and that is load-bearing.
 *
 * A dashboard command reaches PanelMenuBehavior, which reaches the plugin extensions registry, which
 * imports RestrictedGrafanaApisProvider -> dashboardMutationApi -> this module. So by the time this
 * module is evaluated, `DASHBOARD_COMMANDS` may still be mid-initialization and read as undefined.
 * Deferring the read to call time steps over the cycle instead of depending on module order.
 *
 * Notebook commands are flag-gated for the same reason `DashboardMutationClient` gates them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by construction: commands from every resource, each typed on its own scene
export function allMutationCommands(): Array<MutationCommand<any, any>> {
  const notebookCommands = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)
    ? NOTEBOOK_COMMANDS
    : [];

  return [...DASHBOARD_COMMANDS, ...notebookCommands];
}
