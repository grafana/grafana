/**
 * Dashboard Mutation API
 *
 * This module provides a stable API for programmatic dashboard modifications.
 * It is designed for use by Grafana Assistant and other tools that need to modify dashboards.
 *
 * @example
 * ```typescript
 * import { DashboardMutationAPI } from '@grafana/runtime';
 *
 * const api = DashboardMutationAPI.getDashboardMutationAPI();
 * if (api) {
 *   const result = await api.execute({
 *     type: 'ADD_PANEL',
 *     payload: {
 *       panel: {
 *         kind: 'Panel',
 *         spec: {
 *           title: 'CPU Usage',
 *           vizConfig: { kind: 'VizConfig', group: 'timeseries', version: '', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
 *         },
 *       },
 *     },
 *   });
 * }
 * ```
 */

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { Mutation, MutationResult, MutationChange, MutationTransaction, MutationEvent } from './types';

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { ALL_COMMANDS, MUTATION_TYPES, getZodSchema, getJSONSchema, validatePayload } from './commands/registry';

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { CommandDefinition } from './commands/types';

/**
 * @internal Not part of the public API surface.
 */
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { MutationExecutor } from './MutationExecutor';
