/**
 * Loads the dashboard page again, back in edit mode when it was editing: into the open scene in place
 * when it can (resolving true), else as a fresh load onto a new scene. Set by the dashboard page state
 * manager: the scene's modules can't import it without closing an import cycle.
 */
type PageReload = (uid: string, editing: boolean | undefined) => Promise<boolean>;

let pageReload: PageReload | undefined;

export function setPendingChangesPageReload(reload: PageReload) {
  pageReload = reload;
}

/**
 * Loads the page again, or does nothing where no dashboard page is loaded. True when the open scene
 * was reloaded in place, so it is still the page's scene.
 */
export function reloadPendingChangesPage(uid: string, editing: boolean | undefined): Promise<boolean> {
  return pageReload?.(uid, editing) ?? Promise.resolve(false);
}
