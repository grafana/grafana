import { type UserFilter } from 'app/types/user';

export interface UserSearchOptions {
  query: string;
  sort?: string;
  filters?: UserFilter[];
}

export function getUsersSearchUrl({
  query,
  sort,
  filters = [],
  page,
  perPage,
}: UserSearchOptions & { page: number; perPage: number }) {
  const params = new URLSearchParams({ perpage: String(perPage), page: String(page), query });
  for (const filter of filters) {
    const values = Array.isArray(filter.value) ? filter.value.map((value) => value.value) : [filter.value];
    for (const value of values) {
      params.append(String(filter.name), String(value));
    }
  }
  if (sort) {
    params.set('sort', sort);
  }
  return `/api/users/search?${params}`;
}
