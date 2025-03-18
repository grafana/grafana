import { TRAIL_BREAKDOWN_VIEW_KEY, TRAIL_BREAKDOWN_SORT_KEY, OTEL_EXPERIENCE_ENABLED_KEY } from '../shared';

export function getVewByPreference() {
  return localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY) ?? 'grid';
}

export function setVewByPreference(value?: string) {
  return localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, value ?? 'grid');
}

export function getSortByPreference(target: string, defaultSortBy: string) {
  const preference = localStorage.getItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`) ?? '';
  const parts = preference.split('.');
  if (!parts[0] || !parts[1]) {
    return { sortBy: defaultSortBy };
  }
  return { sortBy: parts[0], direction: parts[1] };
}

export function setSortByPreference(target: string, sortBy: string) {
  // Prevent storing empty values
  if (sortBy) {
    localStorage.setItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`, `${sortBy}`);
  }
}

export function getOtelExperienceToggleState(): boolean {
  const val = localStorage.getItem(OTEL_EXPERIENCE_ENABLED_KEY);
  return val !== null ? JSON.parse(val) : true;
}

export function setOtelExperienceToggleState(value: boolean) {
  return localStorage.setItem(OTEL_EXPERIENCE_ENABLED_KEY, value.toString());
}
