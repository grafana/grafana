import { store } from '@grafana/data';

import { FIELD_SELECTOR_MIN_WIDTH, getDefaultFieldSelectorWidth } from './FieldSelector';

export function getFieldSelectorWidth(logOptionsStorageKey?: string): number {
  const defaultWidth = getDefaultFieldSelectorWidth();
  const width =
    (logOptionsStorageKey
      ? parseInt(store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? defaultWidth, 10)
      : undefined) ?? defaultWidth;

  return width < FIELD_SELECTOR_MIN_WIDTH ? FIELD_SELECTOR_MIN_WIDTH : width;
}
export function getFieldSelectorState(logOptionsStorageKey?: string): boolean | undefined {
  if (!logOptionsStorageKey) {
    return undefined;
  }
  const width = parseInt(
    store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? getDefaultFieldSelectorWidth(),
    10
  );
  return width > FIELD_SELECTOR_MIN_WIDTH * 2;
}
