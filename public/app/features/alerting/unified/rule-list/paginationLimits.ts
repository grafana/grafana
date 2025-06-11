export const FRONTEND_LIST_PAGE_SIZE = 100;

export const FILTERED_GROUPS_API_PAGE_SIZE = 2000;
export const DEFAULT_GROUPS_API_PAGE_SIZE = 40;
export const FRONTED_GROUPED_PAGE_SIZE = DEFAULT_GROUPS_API_PAGE_SIZE;

export function getApiGroupPageSize(hasFilters: boolean) {
  return hasFilters ? FILTERED_GROUPS_API_PAGE_SIZE : DEFAULT_GROUPS_API_PAGE_SIZE;
}
