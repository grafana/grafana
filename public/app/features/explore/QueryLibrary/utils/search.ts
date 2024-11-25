import { QueryTemplateRow } from '../QueryTemplatesTable/types';

export const searchQueryLibrary = (
  queryLibrary: QueryTemplateRow[],
  query: string,
  dsFilters: string[],
  userNameFilters: string[]
) => {
  const result = queryLibrary.filter((item) => {
    const matchesDsFilter =
      dsFilters.length === 0 || dsFilters.some((f) => item.datasourceName?.toLowerCase().includes(f.toLowerCase()));
    const matchesUserNameFilter =
      userNameFilters.length === 0 || userNameFilters.includes(item.user?.displayName || '');
    return (
      (item.datasourceName?.toLowerCase().includes(query.toLowerCase()) ||
        item.datasourceType?.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase()) ||
        item.queryText?.toLowerCase().includes(query.toLowerCase())) &&
      matchesDsFilter &&
      matchesUserNameFilter
    );
  });
  return result;
};
