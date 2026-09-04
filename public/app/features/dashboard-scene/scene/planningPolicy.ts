/**
 * What a user may do to a dashboard plan that has not been built yet.
 *
 * A plan preview runs in the dashboard's normal edit mode, which is a superset of what makes sense
 * for it: the panels are placeholders standing in for queries nobody has written, and much of edit
 * mode assumes a real dashboard behind them. Rather than patch each affordance where it is drawn,
 * planning declares its policy once, here, and every surface asks the same question.
 *
 * Two things this file is deliberately shaped around:
 *
 * - **Membership is expected to change.** Which actions belong on a plan is a product question that
 *   will keep moving as the preview gets used. Settling it should be an edit to the set below, not
 *   an audit of every call site.
 * - **Asking is not enforcing.** Hiding a button does not disable the action: URLs and keyboard
 *   shortcuts route around the UI. Every denied action needs its check where the action is
 *   *applied*, and the surface that draws its control should ask the same question so the control
 *   does not appear in the first place.
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

  // Would carry a placeholder out of the plan: a query-less panel pasted into a real dashboard is
  // just a broken panel. Duplicating within the plan is fine and stays allowed.
  'copy-panel',

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
