/**
 * Loads the dashboard page again, back in edit mode when it was editing: into the open scene in place
 * when it can (resolving true), else as a fresh load onto a new scene. Set by the dashboard page state
 * manager: the scene's modules can't import it without closing an import cycle.
 */
type PageReload = (uid: string, editing: boolean | undefined) => Promise<boolean>;

/** Shows the saved dashboard on the page, without the pending changes it showed. Set as PageReload is. */
type PageClose = (uid: string) => Promise<void>;

let pageReload: PageReload | undefined;
let pageClose: PageClose | undefined;

/** Dashboards whose next load on the page opens in edit mode. */
const editingOnNextLoad = new Set<string>();

export function setPendingChangesPageReload(reload: PageReload) {
  pageReload = reload;
}

export function setPendingChangesPageClose(close: PageClose) {
  pageClose = close;
}

/**
 * Loads the page again, or does nothing where no dashboard page is loaded. True when the open scene
 * was reloaded in place, so it is still the page's scene.
 */
export function reloadPendingChangesPage(uid: string, editing: boolean | undefined): Promise<boolean> {
  return pageReload?.(uid, editing) ?? Promise.resolve(false);
}

/**
 * Shows the saved dashboard on the page once its pending changes were saved or discarded, in edit
 * mode with `editing`, or does nothing where no dashboard page is loaded.
 */
export function closePendingChangesPage(uid: string, { editing = false } = {}): Promise<void> {
  if (editing) {
    editingOnNextLoad.add(uid);
  }
  return pageClose?.(uid) ?? Promise.resolve();
}

/** Whether the page's next load of this dashboard opens in edit mode; asking forgets it. */
export function takeEditingOnNextLoad(uid: string | undefined): boolean {
  return uid !== undefined && editingOnNextLoad.delete(uid);
}
