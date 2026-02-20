/**
 * Dashboard Mutation API
 *
 * Stable API for programmatic dashboard modifications, accessed
 * exclusively through RestrictedGrafanaApis.
 */

/* eslint-disable no-barrel-files/no-barrel-files */

export type { MutationRequest, MutationResult, MutationChange, MutationClient, ListVariablesData } from './types';

export { ALL_COMMANDS, MUTATION_TYPES, validatePayload } from './commands/registry';

export type { MutationCommand } from './commands/types';

export { DashboardMutationBehavior } from './DashboardMutationBehavior';
