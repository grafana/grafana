import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { Alert, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';
import { CompletionProvider } from '../traceql/autocomplete';
import { SearchFilter, TempoQuery } from '../types';

import DurationInput from './DurationInput';
import InlineSearchField from './InlineSearchField';
import SearchField from './SearchField';
import TagsInput from './TagsInput';

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

  const [tags, setTags] = useState<string[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, SearchFilter>>({});
  const [traceQlQuery, setTraceQlQuery] = useState<string>('');

  const updateFilter = useCallback((s: SearchFilter) => {
    setFilters((state) => {
      const copy = { ...state };
      copy[s.id] = s;
      return copy;
    });
  }, []);

  // const deleteFilter = (tag: string) => {
  //   const copy = { ...filters };
  //   delete filters[tag];
  //   setFilters(copy);
  // };

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start();
        const tags = datasource.languageProvider.getTags();

        if (tags) {
          // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
          // so Tempo doesn't send anything and we inject it here for the autocomplete
          if (!tags.find((t) => t === 'status')) {
            tags.push('status');
          }
          const tagsWithDot = tags.sort().map((t) => `.${t}`);
          setTags(tagsWithDot);
          setIsTagsLoading(false);
        }
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchTags();
  }, [datasource]);

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

  return (
    <>
      <div className={styles.container}>
        <InlineSearchField label={'Service Name'}>
          <SearchField
            filter={{ id: 'service-name', type: 'static', tag: '.service.name', operator: '=' }}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            tags={[]}
          />
        </InlineSearchField>
        <InlineSearchField label={'Span Name'}>
          <SearchField
            filter={{ id: 'tag-name', type: 'static', tag: 'name', operator: '=' }}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            tags={[]}
          />
        </InlineSearchField>
        <InlineSearchField label={'Duration'}>
          <HorizontalGroup>
            <DurationInput id={'min-duration'} tag={'duration'} operators={['>', '>=']} updateFilter={updateFilter} />
            <DurationInput id={'max-duration'} tag={'duration'} operators={['<', '<=']} updateFilter={updateFilter} />
          </HorizontalGroup>
        </InlineSearchField>
        <InlineSearchField label={'Tags'}>
          <TagsInput
            filters={Object.values(filters)}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            tags={[...CompletionProvider.intrinsics, ...tags]}
            isTagsLoading={isTagsLoading}
          />
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
