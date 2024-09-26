import { logQueryLibrary } from 'app/features/query-library/api/logQueryLibrary';

import { QueryTemplateRow } from '../QueryTemplatesTable/types';

export const searchQueryLibrary = (queryLibrary: QueryTemplateRow[], query: string) => {
  const recordCount = queryLibrary.length;
  const start = performance.now();

  const result = queryLibrary.filter((item) => {
    return (
      item.datasourceType?.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase()) ||
      // TODO: this needs to be a query
      item.user?.toLowerCase().includes(query.toLowerCase())
    );
  });

  const end = performance.now();
  const timeTaken = end - start;

  console.log({ type: 'frontend search', recordCount, searchTime: `${timeTaken} ms` });
  logQueryLibrary('frontend search', recordCount, timeTaken);
  return result;
};
