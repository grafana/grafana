import { store } from '@grafana/data';

import { QUERY_EDITOR_V2_PREFERENCE_KEY } from './constants';

// Kept as an object so entries written by the earlier TTL format ({ value, timestamp }) still parse.
interface StoredQueryEditorPreference {
  value: boolean;
}

export function getQueryEditorNextPreference(): boolean | null {
  const item = store.getObject<Partial<StoredQueryEditorPreference>>(QUERY_EDITOR_V2_PREFERENCE_KEY);
  return typeof item?.value === 'boolean' ? item.value : null;
}

export function setQueryEditorNextPreference(useNext: boolean) {
  const item: StoredQueryEditorPreference = { value: useNext };

  try {
    store.setObject(QUERY_EDITOR_V2_PREFERENCE_KEY, item);
  } catch (error) {
    console.error('Failed to persist query editor preference', error);
  }
}
