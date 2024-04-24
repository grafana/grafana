import React from 'react';

import { useQueryTemplates } from '@grafana/runtime/src/services/queryLibrary/hooks';
import { EmptyState } from '@grafana/ui';

import { getDatasourceSrv } from '../../plugins/datasource_srv';

import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';

export function QueryTemplatesList() {
  const { queryTemplates } = useQueryTemplates();

  const queryTemplateRows: QueryTemplateRow[] = queryTemplates.map((queryTemplate, index) => ({
    index: index.toString(),
    dateAdded: queryTemplate?.formattedDate,
    datasourceType: getDatasourceSrv().getInstanceSettings(queryTemplate.targets[0]?.datasource)?.meta.name,
    queryTemplate,
  }));

  if (!queryTemplateRows.length) {
    return (
      <EmptyState message={`Query Library`} variant="not-found">
        <p>
          {
            "You haven't saved any queries to your library yet. Start adding them from Explore or your Query History tab."
          }
        </p>
      </EmptyState>
    );
  } else {
    return <QueryTemplatesTable queryTemplateRows={queryTemplateRows} />;
  }
}
