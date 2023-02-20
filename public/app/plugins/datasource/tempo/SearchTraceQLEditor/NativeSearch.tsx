import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { Alert, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { SearchFilter, TempoQuery } from '../types';

import DurationInput from './DurationInput';
import InlineSearchField from './InlineSearchField';
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
      const copy = { ...state };
      copy[s.id] = s;
      return copy;
    });
  }, []);

  const deleteFilter = (tag: string) => {
    const copy = { ...filters };
    delete filters[tag];
    setFilters(copy);
  };

  const handleOnChange = useCallback(
    (value) => {
      if (value !== query.query) {
        onChange({
          ...query,
          query: value,
        });
      }
    },
    [onChange, query]
  );

  useEffect(() => {
    setTraceQlQuery(
      `{${Object.values(filters)
        .filter((f) => f.value)
        .map((f) => `${f.tag} ${f.operator} ${f.value}`)
        .join(' && ')}}`
    );
  }, [filters]);

  useEffect(() => {
    handleOnChange(traceQlQuery);
  }, [handleOnChange, traceQlQuery]);

  // const onKeyDown = (keyEvent: React.KeyboardEvent) => {
  //   if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
  //     onRunQuery();
  //   }
  // };

  return (
    <>
      <div className={styles.container}>
        <InlineSearchField label={'Service Name'}>
          <SearchField
            id={'service-name'}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            deleteFilter={deleteFilter}
            tag={'.service.name'}
          />
        </InlineSearchField>
        <InlineSearchField label={'Span Name'}>
          <SearchField
            id={'tag-name'}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            deleteFilter={deleteFilter}
            tag={'name'}
          />
        </InlineSearchField>
        <InlineSearchField label={'Duration'}>
          <HorizontalGroup>
            <DurationInput id={'min-duration'} tag={'duration'} operators={['>', '>=']} updateFilter={updateFilter} />
            <DurationInput id={'max-duration'} tag={'duration'} operators={['<', '<=']} updateFilter={updateFilter} />
          </HorizontalGroup>
        </InlineSearchField>
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
