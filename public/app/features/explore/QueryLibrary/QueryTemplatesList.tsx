import React from 'react';

import { QueryTemplate } from '@grafana/data';
import { useAllQueryTemplatesQuery } from '@grafana/runtime/src/services/queryLibrary';
import { EmptyState, Spinner } from '@grafana/ui';

import { getDatasourceSrv } from '../../plugins/datasource_srv';

import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';

export function QueryTemplatesList() {
  const { data, isLoading, error } = useAllQueryTemplatesQuery();

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

  if (!data) {
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

  const queryTemplateRows: QueryTemplateRow[] = data.map((queryTemplate: QueryTemplate, index: number) => {
    const datasourceRef = queryTemplate.targets[0]?.datasource;
    const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';
    return {
      index: index.toString(),
      datasourceRef,
      datasourceType,
      createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
      query: queryTemplate.targets[0],
      description: queryTemplate.title,
    };
  });

  return <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />;
}
