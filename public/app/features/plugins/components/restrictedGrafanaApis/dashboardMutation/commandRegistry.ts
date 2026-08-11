/**
 * Every Mutation API command, across every document type.
 *
 * Each resource owns its own list — which is what makes a command reachable exactly where it is
 * registered — but `getPayloadSchema` answers for commands that are not currently mounted, so it needs
 * the union. Composed here, at the app-level wiring for this API, because this is the one module that
 * already legitimately sees both features.
 *
 * Kept separate from `dashboardMutationApi.ts` so importing the list does not also run that module's
 * factory registration.
 */

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
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by construction: commands from every resource, each typed on its own scene
export function allMutationCommands(): Array<MutationCommand<any, any>> {
  return [...DASHBOARD_COMMANDS, ...NOTEBOOK_COMMANDS];
}
