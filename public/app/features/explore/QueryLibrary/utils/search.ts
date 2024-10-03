import { QueryTemplateRow } from '../QueryTemplatesTable/types';

export const searchQueryLibrary = (queryLibrary: QueryTemplateRow[], query: string, filter: string[]) => {
  const result = queryLibrary.filter((item) => {
    const matchesFilter =
      filter.length === 0 || filter.some((f) => item.datasourceName?.toLowerCase().includes(f.toLowerCase()));
    return (
      (item.datasourceName?.toLowerCase().includes(query.toLowerCase()) ||
        item.datasourceType?.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase()) ||
        item.queryText?.toLowerCase().includes(query.toLowerCase())) &&
      matchesFilter
    );
  });
  return result;
};
