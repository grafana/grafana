import React from 'react';
import useAsync from 'react-use/lib/useAsync';

import { InlineLabel } from '@grafana/ui';

import { LokiQueryField } from '../loki/components/LokiQueryField';
import { LokiDatasource } from '../loki/datasource';
import { LokiQuery } from '../loki/types';

import { TempoQuery } from './types';
import { getDS } from './utils';

interface LokiSearchProps {
  logsDatasourceUid?: string;
  onChange: (value: LokiQuery) => void;
  onRunQuery: () => void;
  query: TempoQuery;
}

export function LokiSearch({ logsDatasourceUid, onChange, onRunQuery, query }: LokiSearchProps) {
  const dsState = useAsync(() => getDS(logsDatasourceUid), [logsDatasourceUid]);
  if (dsState.loading) {
    return null;
  }

  const ds = dsState.value as LokiDatasource;

  if (ds) {
    return (
      <>
        <InlineLabel>Tempo uses {ds.name} to find traces.</InlineLabel>
        <LokiQueryField
          datasource={ds}
          onChange={onChange}
          onRunQuery={onRunQuery}
          query={query.linkedQuery ?? ({ refId: 'linked' } as LokiQuery)}
          history={[]}
        />
      </>
    );
  }

  if (!logsDatasourceUid) {
    return <div className="text-warning">Please set up a Loki search datasource in the datasource settings.</div>;
  }

  if (logsDatasourceUid && !ds) {
    return (
      <div className="text-warning">
        Loki search datasource is configured but the data source no longer exists. Please configure existing data source
        to use the search.
      </div>
    );
  }

  return null;
}
