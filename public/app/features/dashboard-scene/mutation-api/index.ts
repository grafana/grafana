/**
 * Dashboard Mutation API
 *
 * This module provides a stable API for programmatic dashboard modifications.
 * It is designed for use by Grafana Assistant and other tools that need to modify dashboards.
 *
 * The API is accessed exclusively through RestrictedGrafanaApis -- there is no
 * public singleton or window global. Plugins must be allow-listed in
 * [plugins.restricted_apis_allowlist] to access it.
 */

/* eslint-disable no-barrel-files/no-barrel-files */

export type { MutationRequest, MutationResult, MutationChange, MutationClient, ListVariablesData } from './types';

export { ALL_COMMANDS, MUTATION_TYPES, validatePayload } from './commands/registry';

export type { MutationCommand } from './commands/types';
