import { useMemo, useState } from 'react';

import { EmptyState, FilterInput, Spinner } from '@grafana/ui';
import { useAllQueryTemplatesQuery } from 'app/features/query-library';
import { QueryTemplate } from 'app/features/query-library/types';

import { getDatasourceSrv } from '../../plugins/datasource_srv';

import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';
import { searchQueryLibrary } from './utils/search';

export function QueryTemplatesList() {
  const { data, isLoading, error } = useAllQueryTemplatesQuery();
  const [searchQuery, setSearchQuery] = useState('');

  const allQueryTemplateRows: QueryTemplateRow[] = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.map((queryTemplate: QueryTemplate, index: number) => {
      const datasourceRef = queryTemplate.targets[0]?.datasource;
      const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';

      return {
        index: index.toString(),
        uid: queryTemplate.uid,
        datasourceRef,
        datasourceType,
        createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
        query: queryTemplate.targets[0],
        description: queryTemplate.title,
        user: queryTemplate.user,
      };
    });
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

  if (isLoading) {
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
      />
      <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />
    </>
  );
}
