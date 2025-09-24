import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, InlineField, InlineFieldRow, TextLink, useStyles2 } from '@grafana/ui';

import { AdHocFilter } from './_importedDependencies/components/AdHocFilter/AdHocFilter';
import { AdHocVariableFilter } from './_importedDependencies/components/AdHocFilter/types';
import { PrometheusDatasource } from './_importedDependencies/datasources/prometheus/types';
import { TempoQuery } from './types';
import { getDS } from './utils';

export function ServiceGraphSection({
  graphDatasourceUid,
  query,
  onChange,
}: {
  graphDatasourceUid?: string;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
}) {
  const styles = useStyles2(getStyles);
  const dsState = useAsync(() => getDS(graphDatasourceUid), [graphDatasourceUid]);

  // Check if service graph metrics are being collected. If not, displays a warning
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    async function fn(ds: PrometheusDatasource) {
      const keys = await ds.getTagKeys({
        filters: [
          {
            key: '__name__',
            operator: '=~',
            value:
              'traces_service_graph_request_server_seconds_sum|traces_service_graph_request_total|traces_service_graph_request_failed_total',
            condition: '',
          },
        ],
      });
      setHasKeys(Boolean(keys.length));
    }
    if (!dsState.loading && dsState.value) {
      fn(dsState.value as PrometheusDatasource);
    }
  }, [dsState]);

  if (dsState.loading) {
    return null;
  }

  const ds = dsState.value;

  if (!graphDatasourceUid) {
    return getWarning(
      'No service graph datasource selected',
      'Please set up a service graph datasource in the datasource settings',
      styles
    );
  }

  if (graphDatasourceUid && !ds) {
    return getWarning(
      'No service graph data found',
      'Service graph datasource is configured but the data source no longer exists. Please configure existing data source to use the service graph functionality',
      styles
    );
  }

  const filters = queryToFilter(
    (Array.isArray(query.serviceMapQuery) ? query.serviceMapQuery[0] : query.serviceMapQuery) || ''
  );

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Filter" labelWidth={14} grow>
          <AdHocFilter
            datasource={{ uid: graphDatasourceUid }}
            filters={filters}
            baseFilters={[
              {
                key: '__name__',
                operator: '=~',
                value: 'traces_service_graph_request_total|traces_spanmetrics_calls_total',
                condition: '',
              },
            ]}
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
      {hasKeys === false
        ? getWarning(
            'No service graph data found',
            'Please ensure that service graph metrics are set up correctly',
            styles
          )
        : null}
    </div>
  );
}

function getWarning(title: string, description: string, styles: { alert: string }) {
  return (
    <Alert title={title} severity="info" className={styles.alert}>
      {description} according to the{' '}
      <TextLink external href="https://grafana.com/docs/grafana/latest/datasources/tempo/service-graph/">
        Tempo documentation
      </TextLink>
      .
    </Alert>
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

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css({
    maxWidth: '75ch',
    marginTop: theme.spacing(2),
  }),
});
