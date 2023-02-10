import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { SearchFilter, TempoQuery } from '../types';

import SearchField from './SearchField';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
  onRunQuery: () => void;
}

const NativeSearch = ({ datasource, query, onChange, onBlur, onRunQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const [error, setError] = useState<Error | FetchError | null>(null);

  const [filters, setFilters] = useState<Record<string, SearchFilter>>({});
  const [traceQlQuery, setTraceQlQuery] = useState<string>('');

  const updateFilter = useCallback((s: SearchFilter) => {
    setFilters((state) => {
      if (s.tag) {
        const copy = { ...state };
        copy[s.tag] = s;
        return copy;
      }
      return state;
    });
  }, []);

  const deleteFilter = (tag: string) => {
    const copy = { ...filters };
    delete filters[tag];
    setFilters(copy);
  };

  useEffect(() => {
    setTraceQlQuery(
      `{${Object.values(filters)
        .filter((f) => f.value)
        .map((f) => `${f.tag} ${f.operator} ${f.value}`)
        .join(' && ')}}`
    );
  }, [filters]);

  // const onKeyDown = (keyEvent: React.KeyboardEvent) => {
  //   if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
  //     onRunQuery();
  //   }
  // };

  return (
    <>
      <div className={styles.container}>
        <SearchField
          label={'Service Name'}
          datasource={datasource}
          query={query}
          setError={setError}
          updateFilter={updateFilter}
          deleteFilter={deleteFilter}
          tag={'.service.name'}
        />
        <SearchField
          label={'Span Name'}
          datasource={datasource}
          query={query}
          setError={setError}
          updateFilter={updateFilter}
          deleteFilter={deleteFilter}
          tag={'name'}
        />
        <pre>{traceQlQuery}</pre>
      </div>
      {error ? (
        <Alert title="Unable to connect to Tempo search" severity="info" className={styles.alert}>
          Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can
          configure it in the <a href={`/datasources/edit/${datasource.uid}`}>datasource settings</a>.
        </Alert>
      ) : null}
    </>
  );
};

export default NativeSearch;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    max-width: 500px;
  `,
  alert: css`
    max-width: 75ch;
    margin-top: ${theme.spacing(2)};
  `,
});
