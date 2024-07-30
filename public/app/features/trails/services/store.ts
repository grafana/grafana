import { TRAIL_BREAKDOWN_SORT_KEY } from '../shared';

export function getSortByPreference(target: string, defaultSortBy: string, defaultDirection: 'desc' | 'asc') {
  const preference = localStorage.getItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`) ?? '';
  const parts = preference.split('.');
  if (!parts[0] || !parts[1]) {
    return { sortBy: defaultSortBy, direction: defaultDirection };
  }
  return { sortBy: parts[0], direction: parts[1] };
}

export function setSortByPreference(target: string, sortBy: string, direction: string) {
  // Prevent storing empty values
  if (sortBy && direction) {
    localStorage.setItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`, `${sortBy}.${direction}`);
  }
}
