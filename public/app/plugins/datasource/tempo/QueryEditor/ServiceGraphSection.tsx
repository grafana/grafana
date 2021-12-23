import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { getDS } from './utils';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { AdHocVariableFilter } from '../../../../features/variables/types';
import { TempoQuery } from '../datasource';
import { AdHocFilter } from '../../../../features/variables/adhoc/picker/AdHocFilter';
import { PrometheusDatasource } from '../../prometheus/datasource';

export function ServiceGraphSection({
  graphDatasourceUid,
  query,
  onChange,
}: {
  graphDatasourceUid?: string;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
}) {
  const dsState = useAsync(() => getDS(graphDatasourceUid), [graphDatasourceUid]);
  if (dsState.loading) {
    return null;
  }

  const ds = dsState.value as PrometheusDatasource;

  if (!graphDatasourceUid) {
    return <div className="text-warning">Please set up a service graph datasource in the datasource settings.</div>;
  }

  if (graphDatasourceUid && !ds) {
    return (
      <div className="text-warning">
        Service graph datasource is configured but the data source no longer exists. Please configure existing data
        source to use the service graph functionality.
      </div>
    );
  }
  const filters = queryToFilter(query.serviceMapQuery || '');

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Filter" labelWidth={14} grow>
          <AdHocFilter
            datasource={{ uid: graphDatasourceUid }}
            filters={filters}
            addFilter={(filter: AdHocVariableFilter) => {
              onChange({
                ...query,
                serviceMapQuery: filtersToQuery([...filters, filter]),
              });
            }}
            removeFilter={(index: number) => {
              const newFilters = [...filters];
              newFilters.splice(index, 1);
              onChange({ ...query, serviceMapQuery: filtersToQuery(newFilters) });
            }}
            changeFilter={(index: number, filter: AdHocVariableFilter) => {
              const newFilters = [...filters];
              newFilters.splice(index, 1, filter);
              onChange({ ...query, serviceMapQuery: filtersToQuery(newFilters) });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

function queryToFilter(query: string): AdHocVariableFilter[] {
  let match;
  let filters: AdHocVariableFilter[] = [];
  const re = /([\w_]+)(=|!=|<|>|=~|!~)"(.*?)"/g;
  while ((match = re.exec(query)) !== null) {
    filters.push({
      key: match[1],
      operator: match[2],
      value: match[3],
      condition: '',
    });
  }
  return filters;
}

function filtersToQuery(filters: AdHocVariableFilter[]): string {
  return `{${filters.map((f) => `${f.key}${f.operator}"${f.value}"`).join(',')}}`;
}
