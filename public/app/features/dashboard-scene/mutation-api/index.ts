/**
 * Dashboard Mutation API
 *
 * This module provides a stable API for programmatic dashboard modifications.
 * It is designed for use by Grafana Assistant and other tools that need to modify dashboards.
 *
 * @example
 * ```typescript
 * import { getDashboardMutationAPI } from '@grafana/runtime';
 *
 * const api = getDashboardMutationAPI();
 * if (api && api.canEdit()) {
 *   // Simple: just title and vizType
 *   const result = await api.execute({
 *     type: 'ADD_PANEL',
 *     payload: { title: 'CPU Usage', vizType: 'timeseries' },
 *   });
 *
 *   // Advanced: with full spec
 *   const result2 = await api.execute({
 *     type: 'ADD_PANEL',
 *     payload: {
 *       title: 'Memory Usage',
 *       spec: {
 *         vizConfig: { kind: 'VizConfig', spec: { pluginId: 'stat' } },
 *         data: { kind: 'QueryGroup', spec: { queries: [] } },
 *       },
 *     },
 *   });
 * }
 * ```
 */

// Types - intentionally re-exported as public API surface
// eslint-disable-next-line no-barrel-files/no-barrel-files
export type {
  // Mutation types
  MutationType,
  Mutation,
  MutationPayloadMap,
  MutationResult,
  MutationChange,
  MutationTransaction,
  MutationEvent,

  // Payload types (use schema types directly where possible)
  AddPanelPayload,
  RemovePanelPayload,
  UpdatePanelPayload,
  MovePanelPayload,
  DuplicatePanelPayload,
  AddVariablePayload,
  RemoveVariablePayload,
  UpdateVariablePayload,
  AddRowPayload,
  RemoveRowPayload,
  CollapseRowPayload,
  UpdateTimeSettingsPayload,
  UpdateDashboardMetaPayload,

  // Supporting types
  LayoutPosition,

  // MCP types
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
} from './types';

// Mutation Executor
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { MutationExecutor } from './MutationExecutor';

// MCP Tool Definitions
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { DASHBOARD_MCP_TOOLS, DASHBOARD_MCP_RESOURCES, DASHBOARD_MCP_PROMPTS } from './mcpTools';
