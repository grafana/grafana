import { QueryTemplateRow } from '../QueryTemplatesTable/types';

export const searchQueryLibrary = (queryLibrary: QueryTemplateRow[], query: string) => {
  return queryLibrary.filter((item) => {
    return (
      item.datasourceType?.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase()) ||
      // TODO: this needs to be a query
      item.user?.toLowerCase().includes(query.toLowerCase())
    );
  });
};
