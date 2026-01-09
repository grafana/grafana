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

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type {
  Mutation,
  MutationRequest,
  MutationResult,
  MutationChange,
  MutationClient,
  MutationTransaction,
  MutationEvent,
  ListVariablesData,
} from './types';

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { ALL_COMMANDS, MUTATION_TYPES, validatePayload } from './commands/registry';

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { MutationCommand } from './commands/types';

/**
 * @internal Not part of the public API surface.
 */
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { MutationExecutor } from './MutationExecutor';
