// In-memory "this notebook was just created" signal between the create flows and
// the editor. More reliable than a URL param, which router-level URL syncing can
// drop before the editor reads it. Same-tab by design: creation and the editor
// opening always happen in the same tab.
const newNotebooks = new Set<string>();

export function markNotebookAsNew(uid: string) {
  newNotebooks.add(uid);
}

/** True (once) when the notebook was just created in this tab — used to focus the title. */
export function consumeNewNotebook(uid: string): boolean {
  const isNew = newNotebooks.has(uid);
  newNotebooks.delete(uid);
  return isNew;
}
