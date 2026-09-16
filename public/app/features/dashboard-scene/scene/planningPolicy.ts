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
  | 'share-dashboard'
  // Backend writes triggered from inside a panel, independent of any dashboard save. Covers
  // create/update/delete uniformly: all three call annotationServer() directly.
  | 'annotation'
  // User-driven edits to the variable list from the sidebar, not the plan's own placeholder
  // variables (those are added/removed through the mutation API and are not this action).
  //
  // All four are modelled but *permitted* while planning (absent from DENIED_WHILE_PLANNING
  // below) — a deliberate decision, not an oversight: editing variables during a preview is a
  // documented capability of this feature ("rearrange, rename, add or remove panels, ... edit
  // repeats and variables"), and the assistant identifies its own placeholder variables by a
  // kind+query fingerprint it searches every current variable for and consumes on match, not by
  // position or count. Adding, renaming, removing or reordering a variable therefore cannot
  // cause a real variable to be mistaken for a placeholder, or a placeholder to be missed, at
  // Build time. Kept in this union rather than left unmodelled specifically so a future reader
  // can tell "considered and allowed" apart from "never considered" (see the annotation gap this
  // repo's chokepoint sweep found from the same absence).
  | 'add-variable'
  | 'remove-variable'
  | 'rename-variable'
  | 'move-variable';

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

  // Unlike everything above, this writes straight to the backend with no dashboard save in
  // between and no way for endPlanningSession to undo it on Dismiss — a plan panel's placeholder
  // ID also has no lasting connection to whatever panel ends up at that position once the plan is
  // built or discarded, so an annotation created during planning would outlive the preview it was
  // made on and could attach to an unrelated panel later.
  'annotation',
  // add-variable/remove-variable/rename-variable/move-variable are intentionally not here —
  // see the comment on those members in PlanningAction above for why.
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
