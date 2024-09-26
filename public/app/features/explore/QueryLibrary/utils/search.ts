import { QueryTemplateRow } from '../QueryTemplatesTable/types';

export const searchQueryLibrary = (queryLibrary: QueryTemplateRow[], query: string) => {
  const result = queryLibrary.filter((item) => {
    return (
      item.datasourceType?.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase()) ||
      item.queryText?.toLowerCase().includes(query.toLowerCase())
    );
  });

  return result;
};
