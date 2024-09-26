import { useEffect, useMemo, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { EmptyState, FilterInput, Spinner } from '@grafana/ui';
import { createQueryText } from 'app/core/utils/richHistory';
import { useAllQueryTemplatesQuery } from 'app/features/query-library';
import { QueryTemplate } from 'app/features/query-library/types';

import { getDatasourceSrv } from '../../plugins/datasource_srv';

import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';
import { searchQueryLibrary } from './utils/search';

export function QueryTemplatesList() {
  const { data, isLoading, error } = useAllQueryTemplatesQuery();
  const [searchQuery, setSearchQuery] = useState('');

  const [allQueryTemplateRows, setAllQueryTemplateRows] = useState<QueryTemplateRow[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRows = async () => {
      if (!data) {
        setIsRowsLoading(false);
        return;
      }

      try {
        const rowsPromises = data.map(async (queryTemplate: QueryTemplate, index: number) => {
          const datasourceRef = queryTemplate.targets[0]?.datasource;
          const datasourceApi = await getDataSourceSrv().get(datasourceRef);
          const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';
          const query = queryTemplate.targets[0];
          const queryText = createQueryText(query, datasourceApi);

          return {
            index: index.toString(),
            uid: queryTemplate.uid,
            datasourceRef,
            datasourceType,
            createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
            query,
            queryText,
            description: queryTemplate.title,
            user: queryTemplate.user,
          };
        });

        const rows = await Promise.all(rowsPromises);

        if (isMounted) {
          setAllQueryTemplateRows(rows);
          setIsRowsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching query template rows:', error);
        if (isMounted) {
          setIsRowsLoading(false);
        }
      }
    };

    fetchRows();

    return () => {
      isMounted = false;
    };
  }, [data]);

  const queryTemplateRows = useMemo(
    () => searchQueryLibrary(allQueryTemplateRows, searchQuery),
    [allQueryTemplateRows, searchQuery]
  );

  if (error) {
    return (
      <EmptyState variant="not-found" message={`Something went wrong`}>
        {error.message}
      </EmptyState>
    );
  }

  if (isLoading || isRowsLoading) {
    return <Spinner />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState message={`Query Library`} variant="not-found">
        <p>
          {
            "You haven't saved any queries to your library yet. Start adding them from Explore or your Query History tab."
          }
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <FilterInput
        placeholder="Search by datasource, query content or description"
        value={searchQuery}
        onChange={(query) => setSearchQuery(query)}
        escapeRegex={false}
      />
      <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />
    </>
  );
}
