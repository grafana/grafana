import { TRAIL_BREAKDOWN_VIEW_KEY } from '../shared';

export function getVewByPreference() {
  return localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY) ?? 'grid';
}

export function setVewByPreference(value?: string) {
  return localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, value ?? 'grid');
}
