import { store } from '@grafana/data';

const LAST_USED_NOTEBOOK_KEY = 'grafana.notebooks.lastUsed';

export interface LastUsedNotebook {
  uid: string;
  title: string;
  at: number;
}

/**
 * Remembers the notebook the user most recently created, opened or added to.
 * Powers the "Add to last notebook" quick actions (Figma: the default notebook
 * is the last used one) and the add-to-notebook form's default target.
 */
export function getLastUsedNotebook(): LastUsedNotebook | undefined {
  const value = store.getObject<LastUsedNotebook>(LAST_USED_NOTEBOOK_KEY);
  if (
    !value ||
    typeof value.uid !== 'string' ||
    value.uid === '' ||
    typeof value.title !== 'string' ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at)
  ) {
    return undefined;
  }
  return value;
}

export function setLastUsedNotebook(uid: string, title: string): void {
  if (!uid) {
    return;
  }
  store.setObject(LAST_USED_NOTEBOOK_KEY, { uid, title, at: Date.now() });
}

/** Called when a quick-add fails because the notebook no longer exists. */
export function clearLastUsedNotebook(): void {
  store.delete(LAST_USED_NOTEBOOK_KEY);
}
