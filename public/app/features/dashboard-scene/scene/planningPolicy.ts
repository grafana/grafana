/**
 * Shared action policy for query-less dashboard previews, which run in edit mode.
 * Check the policy both when rendering controls and when applying actions, since
 * URLs, keyboard shortcuts, and drag-and-drop can bypass visible controls.
 *
 * Checking the policy is necessary but not sufficient: a `PlanningAction` also has to be
 * enforced at its chokepoint — the one function, or one reactive sync point, that every route to
 * the restricted behavior is forced through — not at a UI layer above it. `save-dashboard`'s
 * guard briefly sat on `openSaveDrawer` instead of inside `useSaveDashboard`'s `onSaveDashboard`,
 * so a direct caller of `onSaveDashboard` (the legacy JSON-model editor) bypassed it entirely;
 * that was a wrong-layer bug, not a classification bug, and no amount of care with this file
 * would have caught it. Each denial below therefore names its chokepoint, not just its reason.
 *
 * Beyond wrong-layer, this policy's history has two other failure shapes worth naming for
 * whoever next adds or changes an entry:
 *
 *  - Never modelled: a resource with no `PlanningAction` at all, so nothing here can protect it
 *    regardless of how carefully everything else is wired. `annotation` was this until it was
 *    added — dashboard annotation writes went straight to the backend from a panel-context
 *    callback nobody had classified as a planning action in the first place. The standing check
 *    against this shape: for every backend write or state mutation a placeholder panel can
 *    trigger, is there a `PlanningAction` that names it? (Related but not an instance of this:
 *    `settings/VariablesEditView.tsx`, the legacy dashboard-settings "Variables" tab, mutates the
 *    variable set directly through `SceneVariableSet.setState()` rather than through
 *    `add-variable`/`remove-variable`/`rename-variable`/`move-variable`'s chokepoints below. This
 *    is currently inert rather than a gap, because T13 closes the settings view before planning
 *    starts and T11's reversal permits these actions anyway — if either of those changes, this
 *    second implementation is the first place to check.)
 *
 *  - Modelled and deliberately allowed: a `PlanningAction` that exists and is intentionally
 *    absent from `DENIED_WHILE_PLANNING`, because the feature's own documented capabilities say
 *    the action should keep working during a preview. `add-variable`/`remove-variable`/
 *    `rename-variable`/`move-variable` are this — and were briefly denied instead, the one wrong
 *    denial this policy has had (see the comment on those members below for why they're safe to
 *    allow). The tell, restated in case it recurs elsewhere: every legitimate denial in this file
 *    justifies itself by naming a consequence to the user, to another dashboard, to someone
 *    viewing a share, or to a datasource being queried — something outside this feature's own
 *    bookkeeping. A denial whose reasoning is about *our own tracking* getting confused, rather
 *    than about an external actor being harmed, is the shape to check against the documented
 *    capability list before shipping it, not after a reviewer catches it.
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
  // Chokepoint: openPanelEditor(), the only function that sets `editPanel` state.
  'edit-panel',

  // Meaningless without a query: each of these reads or acts on data the placeholder does not have.
  // Chokepoint: PanelMenuBehavior excludes all three wholesale while planning, and
  // keyboardShortcuts.ts guards their bindings directly — no other entry point exists for
  // create-alert-rule or explore-panel. inspect-panel has a third, independent route
  // (setDashboardPanelContext.ts's context.onOpenInspector, wired to the errors/notices popover)
  // guarded separately by T8; it was briefly unguarded and inert only by the incidental fact that
  // the sample generator never reports an error for the popover to attach to, not by design.
  'create-alert-rule',
  'explore-panel',
  'inspect-panel',

  // Would carry a placeholder out of the plan, or something real into it: a query-less panel pasted
  // elsewhere is just a broken panel, and a copied real panel pasted into a plan arrives with a live
  // query. Duplicating within the plan is fine and stays allowed.
  // Chokepoint: DashboardScene.copyPanel() for copy-panel; every layout manager's pastePanel()
  // plus DashboardScene.pastePanel()/DashboardSidebar.pastePanel() for paste-panel (redundant by
  // manager rather than one true chokepoint, but each caller resolves to one of these guarded
  // implementations); RowItem.onCopy()/TabItem.onCopy() via isCopyAllowed() for copy-section;
  // RowsLayoutManager.pasteRow()/TabsLayoutManager.pasteTab() for paste-section.
  'copy-panel',
  'paste-panel',
  'copy-section',
  'paste-section',

  // Sharing and snapshots can expose synthetic placeholder data as dashboard results.
  // Chokepoint: keyboardShortcuts.ts's guarded binding, plus PanelMenuBehavior excluding the
  // sharing entry wholesale while planning — no separate share affordance exists outside those two.
  'share-panel',

  // A library panel brings its own queries, so it cannot be added in placeholder form.
  // Chokepoint: DashboardScene.onShowAddLibraryPanelDrawer(), the only function every caller
  // (toolbar, panel menu, empty-state button) resolves to.
  'add-library-panel',

  // There is no dashboard to save, configure or share until the plan is built. The planning banner
  // offers Build and Dismiss in place of these.
  // Chokepoint: save-dashboard is useSaveDashboard's onSaveDashboard, the one function every save
  // path calls (see T7 — the guard briefly sat one layer up, on openSaveDrawer, and missed a
  // caller that skipped the drawer). dashboard-settings and share-dashboard are both guarded in
  // DashboardSceneUrlSync.updateFromUrl, the only place that sets `editview`/`shareView` from a URL.
  'save-dashboard',
  'dashboard-settings',
  'share-dashboard',

  // Unlike everything above, this writes straight to the backend with no dashboard save in
  // between and no way for endPlanningSession to undo it on Dismiss — a plan panel's placeholder
  // ID also has no lasting connection to whatever panel ends up at that position once the plan is
  // built or discarded, so an annotation created during planning would outlive the preview it was
  // made on and could attach to an unrelated panel later.
  // Chokepoint: setDashboardPanelContext.ts's onAnnotationCreate/onAnnotationUpdate/
  // onAnnotationDelete, via the shared refuseWhilePlanningAnnotation() check — this was the
  // "never modelled" gap (see the file doc comment above): before T10, no PlanningAction named
  // this resource at all, so there was nothing to enforce regardless of chokepoint placement.
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
