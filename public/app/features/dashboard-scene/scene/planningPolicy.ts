/**
 * Shared action policy for query-less dashboard previews, which run in edit mode.
 * Check the policy both when rendering controls and when applying actions, since
 * URLs, keyboard shortcuts, and drag-and-drop can bypass visible controls.
 */

/** An action a user can take on a dashboard, named so planning can allow or deny it. */
export type PlanningAction =
  // Structural edits to the plan itself — the point of the preview.
  | 'add-panel'
  | 'remove-panel'
  | 'duplicate-panel'
  | 'move-panel'
  | 'resize-panel'
  | 'rename-panel'
  | 'change-visualization'
  | 'set-repeat'
  | 'edit-plan-panel'
  // Actions that assume a real, saved dashboard or a panel with a query behind it.
  | 'edit-panel'
  | 'copy-panel'
  | 'paste-panel'
  | 'copy-section'
  | 'paste-section'
  | 'share-panel'
  | 'add-library-panel'
  | 'create-alert-rule'
  | 'explore-panel'
  | 'inspect-panel'
  | 'save-dashboard'
  | 'dashboard-settings'
  | 'share-dashboard';

/**
 * Actions withheld while a plan is being previewed.
 *
 * Grouped by why, because the reason is what should be argued with when this list changes.
 */
const DENIED_WHILE_PLANNING: ReadonlySet<PlanningAction> = new Set<PlanningAction>([
  // Destructive: the panel editor materializes a default query for a panel that has none, which
  // silently turns a placeholder into a live-querying panel and fires a request at a datasource.
  // Plan-level editing of a panel is offered separately, over the plan's own fields.
  'edit-panel',

  // Meaningless without a query: each of these reads or acts on data the placeholder does not have.
  'create-alert-rule',
  'explore-panel',
  'inspect-panel',

  // Would carry a placeholder out of the plan, or something real into it: a query-less panel pasted
  // elsewhere is just a broken panel, and a copied real panel pasted into a plan arrives with a live
  // query. Duplicating within the plan is fine and stays allowed.
  'copy-panel',
  'paste-panel',
  'copy-section',
  'paste-section',

  // Sharing and snapshots can expose synthetic placeholder data as dashboard results.
  'share-panel',

  // A library panel brings its own queries, so it cannot be added in placeholder form.
  'add-library-panel',

  // There is no dashboard to save, configure or share until the plan is built. The planning banner
  // offers Build and Dismiss in place of these.
  'save-dashboard',
  'dashboard-settings',
  'share-dashboard',
]);

/**
 * Whether `action` is permitted on a plan preview.
 *
 * Callers on a dashboard should prefer `DashboardScene.isPlanningActionAllowed`, which answers
 * `true` outside planning so the caller needs no planning check of its own.
 */
export function isActionAllowedWhilePlanning(action: PlanningAction): boolean {
  return !DENIED_WHILE_PLANNING.has(action);
}
