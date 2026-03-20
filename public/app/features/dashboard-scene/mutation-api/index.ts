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

/**
 * Routing rules — what goes through MutationClient vs. direct scene mutations.
 *
 * **Must go through MutationClient:**
 *   Any change that should be visible to plugins (RestrictedGrafanaApis), recorded
 *   in audit logging, participate in undo/redo, or be broadcast for multiplayer
 *   collaboration. Examples: panel options, field config, title/description,
 *   add/remove panel, dashboard-level info (title, tags, description).
 *
 * **May stay as direct scene mutations:**
 *   Transient UI state (hover, selection, panel collapse), internal scene
 *   bookkeeping, and layout drag/resize operations.
 *
 * **Currently routed operations:**
 *   - UPDATE_DASHBOARD_INFO — title, description, tags (GeneralSettingsEditView)
 *   - UPDATE_PANEL — title, description, options, fieldConfig, vizConfig,
 *     data/queries (PanelOptions, getPanelFrameOptions, DashboardScene.updatePanelTitle)
 *   - ADD_PANEL (CanvasGridAddActions)
 *   - REMOVE_PANEL (DashboardScene.removePanel, PanelMenuBehavior)
 *
 * **Known gaps (not yet routed):**
 *   - Panel background/transparent toggle (undoable edit actions)
 *   - Repeat options
 *   - Panel links edits outside UPDATE_PANEL
 *   - Layout drag/resize
 */

/* eslint-disable no-barrel-files/no-barrel-files */

export type {
  MutationRequest,
  MutationResult,
  MutationChange,
  MutationClient,
  LayoutItemKind,
  PanelElementEntry,
  PanelElementsData,
  ListVariablesData,
} from './types';

export { ALL_COMMANDS, MUTATION_TYPES, validatePayload } from './commands/registry';

export type { MutationCommand } from './commands/types';

export { useDashboardMutationClient } from './useDashboardMutationClient';
