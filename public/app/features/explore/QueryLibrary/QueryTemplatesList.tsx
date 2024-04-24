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
    return <EmptyState variant="not-found" message={`Ooops! Something went wrong. Error: ${error.message}`} />;
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

  const queryTemplateRows: QueryTemplateRow[] = data!.map((queryTemplate: QueryTemplate, index: number) => ({
    index: index.toString(),
    dateAdded: queryTemplate?.formattedDate,
    datasourceType: getDatasourceSrv().getInstanceSettings(queryTemplate.targets[0]?.datasource)?.meta.name,
    queryTemplate,
  }));

  return <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />;
}
