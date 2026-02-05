import { store } from '@grafana/data';

import { FIELD_SELECTOR_DEFAULT_WIDTH, FIELD_SELECTOR_MIN_WIDTH } from './FieldSelector';

export function getFieldSelectorWidth(logOptionsStorageKey?: string): number {
  const width =
    (logOptionsStorageKey
      ? parseInt(store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? FIELD_SELECTOR_DEFAULT_WIDTH, 10)
      : undefined) ?? FIELD_SELECTOR_DEFAULT_WIDTH;

  return width < FIELD_SELECTOR_MIN_WIDTH ? FIELD_SELECTOR_MIN_WIDTH : width;
}
export function getFieldSelectorState(logOptionsStorageKey?: string): boolean | undefined {
  if (!logOptionsStorageKey) {
    return undefined;
  }
  const width = parseInt(store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? FIELD_SELECTOR_DEFAULT_WIDTH, 10);
  return width <= FIELD_SELECTOR_MIN_WIDTH * 2 ? false : true;
}
