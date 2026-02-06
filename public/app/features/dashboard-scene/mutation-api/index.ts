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
export type {
  MutationType,
  Mutation,
  MutationPayloadMap,
  MutationResult,
  MutationChange,
  MutationTransaction,
  MutationEvent,
  AddPanelPayload,
  RemovePanelPayload,
  UpdatePanelPayload,
  AddVariablePayload,
  RemoveVariablePayload,
  UpdateVariablePayload,
  UpdateTimeSettingsPayload,
  UpdateDashboardMetaPayload,
  CommandSchemaDefinition,
  ResourceSchemaDefinition,
  PromptSchemaDefinition,
} from './types';

/**
 * @internal Not part of the public API surface.
 */
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { MutationExecutor } from './MutationExecutor';

// eslint-disable-next-line no-barrel-files/no-barrel-files
export {
  DASHBOARD_COMMAND_SCHEMAS,
  DASHBOARD_RESOURCE_SCHEMAS,
  DASHBOARD_PROMPT_SCHEMAS,
  getCommandSchemaByName,
  getResourceSchemaByUri,
} from './commandSchemas';
