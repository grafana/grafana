import { store } from '@grafana/data';

export function saveSectionOpenState(id: string, isOpen: boolean) {
  store.set(`panel-edit-section-${id}`, isOpen ? 'true' : 'false');
}

export function getSectionOpenState(id: string, defaultValue: boolean) {
  return store.getBool(`panel-edit-section-${id}`, defaultValue);
}
