/**
 * Mutation Handlers
 *
 * Pure functions that implement dashboard mutations.
 * Each handler receives a payload and context, and returns a MutationResult.
 */

// Types
// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { MutationContext, MutationTransactionInternal, MutationHandler } from './types';

// Panel handlers
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { handleAddPanel, handleRemovePanel, handleUpdatePanel, handleMovePanel } from './panelHandlers';

// Variable handlers
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { handleAddVariable, handleRemoveVariable } from './variableHandlers';

// Dashboard handlers
// eslint-disable-next-line no-barrel-files/no-barrel-files
export {
  handleAddRow,
  handleUpdateTimeSettings,
  handleUpdateDashboardMeta,
  handleGetDashboardInfo,
} from './dashboardHandlers';
