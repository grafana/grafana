/**
 * Loads the dashboard page again, fresh, back in edit mode when it was editing. Set by the dashboard
 * page state manager: the scene's modules can't import it without closing an import cycle.
 */
type PageReload = (uid: string, editing: boolean | undefined) => Promise<void>;

let pageReload: PageReload | undefined;

export function setPendingChangesPageReload(reload: PageReload) {
  pageReload = reload;
}

/** Loads the page again, or does nothing where no dashboard page is loaded. */
export function reloadPendingChangesPage(uid: string, editing: boolean | undefined): Promise<void> {
  return pageReload?.(uid, editing) ?? Promise.resolve();
}
