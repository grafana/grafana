/**
 * UserActionCommand -- the shared mutation primitive.
 *
 * Implemented as a class (so private fields can carry data needed for
 * declarative undo). Both the UI and the agent build instances of these
 * classes and dispatch them through `dashboardEditActions.executeUserAction`,
 * which runs `perform` and registers the action on the existing
 * DashboardEditPane undo/redo stack via DashboardEditActionEvent.
 *
 * Inverse mutations are declarative: `undo()` uses stored primitives
 * (name, index, VariableKind) rather than captured Scene-object references,
 * so redo remains safe even when surrounding state has changed.
 */
export interface UserActionCommand {
  /** Human-readable label for undo/redo UI buttons (e.g. "Add variable 'env'"). */
  title: string;
  /**
   * Optional write-lock target this command operates against (e.g. 'variables').
   * If the target is locked at execute() time, `executeUserAction` short-circuits
   * with { success: false, locked: true } without calling perform().
   */
  lockTarget?: string;
  /** Apply the mutation to the Scene. */
  perform(): void;
  /** Reverse the mutation using stored data, not Scene references. */
  undo(): void;
}
